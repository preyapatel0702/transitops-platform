import { z } from "zod";

export const vehicleStatusEnum = z.enum(["AVAILABLE", "ON_TRIP", "IN_SHOP", "RETIRED"]);

export const createVehicleSchema = z.object({
  registrationNumber: z.string().min(2, "Registration number is required"),
  vehicleName: z.string().min(1, "Vehicle name is required"),
  model: z.string().min(1, "Model is required"),
  vehicleType: z.string().min(1, "Vehicle type is required"),
  region: z.string().min(1, "Region is required"),
  maxLoadCapacity: z.number().positive("Max load capacity must be positive"),
  odometer: z.number().nonnegative("Odometer cannot be negative").default(0),
  acquisitionCost: z.number().positive("Acquisition cost must be positive"),
  status: vehicleStatusEnum.optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial().extend({
  id: z.string().min(1),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
