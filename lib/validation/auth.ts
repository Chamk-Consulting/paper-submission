import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Use at most 128 characters");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(128),
  next: z.string().optional(),
});

export const signUpSchema = z.object({
  givenName: z.string().trim().min(1, "Enter your given name").max(120),
  familyName: z.string().trim().min(1, "Enter your family name").max(120),
  email,
  password,
  consent: z.literal("on", { message: "Please accept the terms and privacy notice" }),
  next: z.string().optional(),
});

export const forgotSchema = z.object({ email });

export const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

export type FormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};
