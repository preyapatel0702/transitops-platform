import { z } from "zod";

export const documentTypeEnum = z.enum([
  "REGISTRATION_CERTIFICATE",
  "INSURANCE",
  "PERMIT",
  "POLLUTION_CERTIFICATE",
  "FITNESS",
  "OTHER",
]);

export const createVehicleDocumentSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required"),
  docType: documentTypeEnum,
  documentNumber: z.string().optional(),
  documentUrl: z.string().url("Document URL must be a valid URL"),
  expiryDate: z.coerce.date().optional(),
});

export const updateVehicleDocumentSchema = z.object({
  id: z.string().min(1),
  docType: documentTypeEnum.optional(),
  documentNumber: z.string().optional(),
  documentUrl: z.string().url("Document URL must be a valid URL").optional(),
  expiryDate: z.coerce.date().optional(),
});

export type CreateVehicleDocumentInput = z.infer<typeof createVehicleDocumentSchema>;
export type UpdateVehicleDocumentInput = z.infer<typeof updateVehicleDocumentSchema>;
