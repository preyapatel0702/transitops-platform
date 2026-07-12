import { z } from "zod";

export const expenseTypeEnum = z.enum(["TOLL", "MAINTENANCE", "INSURANCE", "OTHER"]);

export const createExpenseSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required"),
  expenseType: expenseTypeEnum,
  amount: z.number().positive("Amount must be positive"),
  description: z.string().min(1, "Description is required"),
  date: z.coerce.date().default(() => new Date()),
});

export const updateExpenseSchema = createExpenseSchema.partial().extend({
  id: z.string().min(1),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
