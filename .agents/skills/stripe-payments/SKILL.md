---
name: stripe-payments
description: Implement Stripe payment workflows, checkout sessions, customer management, webhook event processing, signature verification, and atomic database enrollment transactions.
---

# Stripe Payments & Webhooks Skill

## Purpose

Implement and maintain end-to-end payment processing for course enrollments and subscriptions using Stripe and Prisma in `career-it-backend`.

---

## 1. Stripe Setup & Client Initialization

Always import the centralized Stripe instance from `src/app/libs/stripe.ts`:

```typescript
import { stripe } from '../../libs/stripe';
import config from '../../../configs';
```

---

## 2. Checkout Session Creation

When a student initiates a course purchase, create a hosted checkout session with metadata:

```typescript
const createCourseCheckoutSession = async ({
  userId,
  userEmail,
  courseId,
  courseTitle,
  priceInCents,
}: {
  userId: string;
  userEmail: string;
  courseId: string;
  courseTitle: string;
  priceInCents: number;
}) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: userEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: courseTitle,
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      courseId,
      type: 'COURSE_ENROLLMENT',
    },
    success_url: `${config.client_url}/dashboard/student/courses/${courseId}?payment=success`,
    cancel_url: `${config.client_url}/courses/${courseId}?payment=cancelled`,
  });

  return { sessionId: session.id, checkoutUrl: session.url };
};
```

---

## 3. Webhook Handling & Signature Verification

Never fulfill orders based on frontend redirects (`success_url`). Only fulfill orders via verified Stripe webhooks.

### Express Webhook Route Setup

Stripe webhooks require the raw request body (unparsed buffer) to verify the cryptographic signature:

```typescript
// In src/app/modules/payment/payment.route.ts
import express from 'express';
import { PaymentControllers } from './payment.controller';

const router = express.Router();

router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  PaymentControllers.handleStripeWebhook,
);

export const PaymentRoutes = router;
```

### Webhook Controller Verification

```typescript
import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { stripe } from '../../libs/stripe';
import config from '../../../configs';
import { PaymentServices } from './payment.service';

const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhook_secret as string);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown webhook error';
    return res.status(httpStatus.BAD_REQUEST).send(`Webhook Error: ${message}`);
  }

  // Delegate event processing to service
  await PaymentServices.processStripeEvent(event);

  res.status(httpStatus.OK).json({ received: true });
};
```

---

## 4. Idempotent & Atomic Order Fulfillment

Handle critical events inside Prisma transactions to guarantee idempotency and atomicity:

```typescript
import Stripe from 'stripe';
import prisma from '../../libs/prisma';

const processStripeEvent = async (event: Stripe.Event) => {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { userId, courseId, type } = session.metadata || {};

    if (type === 'COURSE_ENROLLMENT' && userId && courseId) {
      await prisma.$transaction(async (tx) => {
        // 1. Check if enrollment already processed (Idempotency)
        const existingEnrollment = await tx.courseEnrollment.findFirst({
          where: { studentId: userId, courseId },
        });
        if (existingEnrollment) return;

        // 2. Record payment transaction
        await tx.payment.create({
          data: {
            userId,
            courseId,
            stripeSessionId: session.id,
            amount: (session.amount_total || 0) / 100,
            currency: session.currency || 'usd',
            status: 'COMPLETED',
          },
        });

        // 3. Create course enrollment
        await tx.courseEnrollment.create({
          data: {
            studentId: userId,
            courseId,
            enrolledAt: new Date(),
          },
        });

        // 4. Increment student count on course
        await tx.course.update({
          where: { id: courseId },
          data: { studentCount: { increment: 1 } },
        });
      });
    }
  }
};
```

---

## 5. Security & Reliability Rules

1. Always store `stripeSessionId` and enforce unique constraints to prevent duplicate fulfillment.
2. Never store raw credit card details or CVVs on the server.
3. Keep webhook secret securely in `.env` (`STRIPE_WEBHOOK_SECRET`).
4. Always respond with HTTP 200 promptly to prevent Stripe webhook retries from flooding the server.
