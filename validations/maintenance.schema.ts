import { z } from "zod";

export const maintenanceStatusEnum = z.enum(["ACTIVE", "COMPLETED"]);

export const createMaintenanceSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required"),
  maintenanceType: z.string().min(1, "Maintenance type is required"),
  description: z.string().min(1, "Description is required"),
  cost: z.number().positive("Cost must be positive"),
  date: z.coerce.date().default(() => new Date()),
});

export const closeMaintenanceSchema = z.object({
  id: z.string().min(1),
});

export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>;
export type CloseMaintenanceInput = z.infer<typeof closeMaintenanceSchema>;
