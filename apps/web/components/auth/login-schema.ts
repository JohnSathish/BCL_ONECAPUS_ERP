import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(2, 'Enter your college roll number or email')
    .max(120, 'Identifier is too long'),
  password: z.string().min(1, 'Enter your password'),
  rememberMe: z.boolean().optional(),
  challengeAnswer: z
    .string()
    .min(1, 'Enter the verification answer')
    .refine((v) => /^-?\d+$/.test(v.trim()), 'Enter a valid number'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const DEMO_CREDENTIALS = [
  { label: 'Institution Admin', email: 'admin@demo.edu', password: 'Admin@123' },
  { label: 'Morning Shift Admin', email: 'morning.admin@demo.edu', password: 'Shift@123' },
  { label: 'Day Shift Admin', email: 'day.admin@demo.edu', password: 'Shift@123' },
  { label: 'Evening Shift Admin', email: 'evening.admin@demo.edu', password: 'Shift@123' },
] as const;
