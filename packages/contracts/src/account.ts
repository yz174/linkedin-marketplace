import { z } from 'zod';

export const ACCOUNT_TYPES = ['brand', 'creator'] as const;

export const AccountType = z.enum(ACCOUNT_TYPES);
export type AccountType = z.infer<typeof AccountType>;

export const Email = z.string().trim().toLowerCase().email();

export const SignUp = z.object({
  email: Email,
  password: z.string().min(12).max(200),
  name: z.string().trim().min(1).max(120),
  accountType: AccountType
});
export type SignUp = z.infer<typeof SignUp>;

export const SignIn = z.object({
  email: Email,
  password: z.string().min(1),
  accountType: AccountType
});
export type SignIn = z.infer<typeof SignIn>;

export const Session = z.object({
  userId: z.string().uuid(),
  email: Email,
  accountType: AccountType,
  workspaceId: z.string().uuid().nullable()
});
export type Session = z.infer<typeof Session>;

export const ERROR_CODES = [
  'email_belongs_to_other_account_type',
  'email_taken',
  'invalid_credentials',
  'not_authenticated',
  'wrong_account_type',
  'not_found',
  'thin_page',
  'validation_failed'
] as const;

export const ErrorCode = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiError = z.object({
  code: ErrorCode,
  message: z.string()
});
export type ApiError = z.infer<typeof ApiError>;
