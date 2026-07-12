import { z } from "zod";

export const createFuelLogSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required"),
  liters: z.number().positive("Liters must be positive"),
  cost: z.number().positive("Cost must be positive"),
  date: z.coerce.date().default(() => new Date()),
});

export type CreateFuelLogInput = z.infer<typeof createFuelLogSchema>;
