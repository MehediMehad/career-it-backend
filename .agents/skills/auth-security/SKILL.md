---
name: auth-security
description: Implement authentication and authorization, JWT token management, Redis token blacklisting, OTP generation, password hashing, and endpoint security guards.
---

# Authentication & Security Skill

## Purpose

Maintain secure authentication, role-based authorization, token lifecycle with Redis blacklisting, and password management in `career-it-backend`.

---

## 1. Role-Based Auth Guard (`auth.ts`)

Endpoints requiring authentication must be protected by the `auth` middleware:

```typescript
import { UserRoleEnum } from '@prisma/client';
import auth from '../../middlewares/auth';

// Only Admin
router.post('/', auth(UserRoleEnum.ADMIN), Controller.create);

// Admin or Instructor
router.patch('/:id', auth(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR), Controller.update);

// Any authenticated user
router.get('/my-profile', auth(), Controller.getProfile);
```

### How `auth` middleware works:

1. Extracts Bearer token from `req.headers.authorization`.
2. Checks if token is in Redis blacklist (`blacklist:<token>`). If blacklisted, rejects with 401 Unauthorized.
3. Verifies token signature using `jwtHelpers.verifyToken(token, config.jwt.secret)`.
4. Attaches verified user to `req.user`.
5. Checks role permission against allowed roles.

---

## 2. Token Management & Redis Blacklisting

### Redis Token Revocation on Logout

When a user logs out:

- The current JWT access token must be revoked immediately by writing it to Redis with an expiration matching the token's lifetime (e.g. 24 hours):

```typescript
import redisClient from '../../libs/redis';

const logoutUser = async (token: string) => {
  const tokenKey = `blacklist:${token}`;
  // 24 hours TTL (86400 seconds)
  await redisClient.set(tokenKey, 'true', 'EX', 86400);
};
```

---

## 3. OTP Verification via Redis

Never persist temporary OTPs to the database. Use Redis with TTL:

- **Key Pattern**: `otp:<email>:<type>` (e.g. `otp:john@example.com:FORGOT_PASSWORD`)
- **TTL**: 600 seconds (10 minutes)
- **Rate Limiting**: Limit OTP resends (e.g., maximum 3 requests per 10 minutes)

```typescript
import redisClient from '../../libs/redis';

// Save OTP
const saveOtp = async (email: string, type: string, otp: string) => {
  const key = `otp:${email}:${type}`;
  await redisClient.set(key, otp, 'EX', 600);
};

// Verify OTP
const verifyOtp = async (email: string, type: string, enteredOtp: string) => {
  const key = `otp:${email}:${type}`;
  const storedOtp = await redisClient.get(key);
  if (!storedOtp || storedOtp !== enteredOtp) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP');
  }
  // Delete after successful verification
  await redisClient.del(key);
};
```

---

## 4. Password Security Standards

1. **Hashing**: Always hash passwords using `bcrypt.hash(password, Number(config.bcrypt_salt_rounds) || 12)`.
2. **Comparison**: Use `bcrypt.compare(candidatePassword, user.password)`.
3. **Exclusion**: Never return password hashes in API responses:
   ```typescript
   select: {
     id: true,
     email: true,
     role: true,
     // Exclude password
   }
   ```

---

## 5. Security Checklist

- Input validation on every route via Zod.
- Sensitive operations run in transactions.
- CORS configured with whitelist origins.
- Rate limiting on sensitive routes (`/auth/login`, `/auth/forgot-password`).
- No plain text credentials or tokens logged to console in production.
