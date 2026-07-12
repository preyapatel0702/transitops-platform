import { z } from "zod";

export const tripStatusEnum = z.enum(["DRAFT", "DISPATCHED", "COMPLETED", "CANCELLED"]);

export const createTripSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required"),
  driverId: z.string().min(1, "Driver is required"),
  source: z.string().min(1, "Source is required"),
  destination: z.string().min(1, "Destination is required"),
  cargoWeight: z.number().positive("Cargo weight must be positive"),
  plannedDistance: z.number().positive("Planned distance must be positive"),
  revenue: z.number().positive("Revenue must be positive").optional(),
});

export const updateTripSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1).optional(),
  destination: z.string().min(1).optional(),
  cargoWeight: z.number().positive().optional(),
  plannedDistance: z.number().positive().optional(),
  revenue: z.number().positive().optional(),
});

export const completeTripSchema = z.object({
  id: z.string().min(1),
  finalOdometer: z.number().positive("Final odometer must be positive"),
  fuelUsed: z.number().positive("Fuel used must be positive"),
  fuelCost: z.number().nonnegative("Fuel cost cannot be negative"),
  actualDistance: z.number().positive("Actual distance must be positive"),
});

export const cancelTripSchema = z.object({
  id: z.string().min(1),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type CompleteTripInput = z.infer<typeof completeTripSchema>;
export type CancelTripInput = z.infer<typeof cancelTripSchema>;
