import { z } from "zod";

export const createCircleSchema = z.object({
  name: z.string().min(3, "Circle name must be at least 3 characters").max(60),
  contributionNgn: z
    .number()
    .min(1000, "Minimum contribution is ₦1,000")
    .max(5_000_000, "Maximum contribution is ₦5,000,000"),
  maxMembers: z.number().min(2, "Minimum 2 members").max(20, "Maximum 20 members"),
  cycleFrequency: z.enum(["weekly", "biweekly", "monthly"]),
  category: z.enum(["family", "friends", "coworkers", "diaspora"]),
});

export const joinCircleSchema = z.object({
  circleId: z.string().uuid(),
  stellarPublicKey: z.string().length(56, "Invalid Stellar public key"),
});

export const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/),
  otp: z.string().length(6),
});

export type CreateCircleInput = z.infer<typeof createCircleSchema>;
export type JoinCircleInput = z.infer<typeof joinCircleSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
