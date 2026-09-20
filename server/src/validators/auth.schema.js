import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'));

export const registerSchema = z.object({
  email,
  // bcrypt only uses the first 72 bytes, so cap the length
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password is too long'),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(72, 'Password is too long'),
});