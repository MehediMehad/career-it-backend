import { z } from 'zod';

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      content: z.string().min(1, 'Message content cannot be empty'),
    })
  ).min(1, 'At least one message is required'),
});

export const AIValidations = {
  chatSchema,
};

