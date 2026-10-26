import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from './password.js';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required.').email('Email is not valid.').max(150),
  password: z.string().min(1, 'Password is required.').max(200),
});

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(200, 'Password is too long.');

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current Password is required.').max(200),
  new_password: newPasswordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
