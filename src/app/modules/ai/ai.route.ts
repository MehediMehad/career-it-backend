import express from 'express';
import rateLimit from 'express-rate-limit';

import { AIController } from './ai.controller';
import { AIValidations } from './ai.validation';
import validateRequest from '../../middlewares/validateRequest';

const router = express.Router();

// Rate limiter for public AI Chat to prevent API abuse
const aiChatLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30, // 30 messages per 10 minutes
  message: {
    success: false,
    message: 'Too many requests. Please try again after a few minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public Chat endpoint for website visitors
router.post(
  '/counselor/chat',
  aiChatLimiter,
  validateRequest(AIValidations.chatSchema),
  AIController.chatWithCounselor,
);

// Sync courses and platform info into vector knowledge base
router.post('/knowledge/sync', AIController.syncKnowledge);

export const AIRoutes = router;
