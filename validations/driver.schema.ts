import { z } from "zod";

export const driverStatusEnum = z.enum(["AVAILABLE", "ON_TRIP", "OFF_DUTY", "SUSPENDED"]);

export const createDriverSchema = z.object({
  name: z.string().min(1, "Name is required"),
  licenseNumber: z.string().min(2, "License number is required"),
  licenseCategory: z.string().min(1, "License category is required"),
  licenseExpiryDate: z.coerce.date().refine((d) => d > new Date(), {
    message: "License expiry date must be in the future",
  }),
  contactNumber: z.string().min(6, "Valid contact number is required"),
  safetyScore: z.number().positive("Safety score must be positive").max(100).default(100),
  status: driverStatusEnum.optional(),
});

export const updateDriverSchema = createDriverSchema.partial().extend({
  id: z.string().min(1),
});

export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
