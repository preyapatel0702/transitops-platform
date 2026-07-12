"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN_MANAGE_FLEET, CAN_VIEW_ALL } from "@/utils/rbac";
import { runAction, BusinessRuleError } from "@/utils/api-response";
import {
  createVehicleDocumentSchema,
  updateVehicleDocumentSchema,
  CreateVehicleDocumentInput,
  UpdateVehicleDocumentInput,
} from "@/validations/document.schema";

export async function createVehicleDocument(input: CreateVehicleDocumentInput) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_FLEET);
    const data = createVehicleDocumentSchema.parse(input);

    const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
    if (!vehicle) throw new BusinessRuleError("Vehicle not found");

    const doc = await prisma.vehicleDocument.create({ data });
    revalidatePath("/vehicles");
    return doc;
  });
}

export async function getVehicleDocuments(vehicleId: string) {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    return prisma.vehicleDocument.findMany({
      where: { vehicleId },
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function updateVehicleDocument(input: UpdateVehicleDocumentInput) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_FLEET);
    const data = updateVehicleDocumentSchema.parse(input);
    const { id, ...rest } = data;

    const doc = await prisma.vehicleDocument.findUnique({ where: { id } });
    if (!doc) throw new BusinessRuleError("Document not found");

    const updated = await prisma.vehicleDocument.update({ where: { id }, data: rest });
    revalidatePath("/vehicles");
    return updated;
  });
}

export async function deleteVehicleDocument(id: string) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_FLEET);
    const doc = await prisma.vehicleDocument.findUnique({ where: { id } });
    if (!doc) throw new BusinessRuleError("Document not found");

    await prisma.vehicleDocument.delete({ where: { id } });
    revalidatePath("/vehicles");
    return { id };
  });
}

/**
 * Vehicle documents expiring within `daysAhead` days (default 30) — powers
 * compliance banners and the email reminder cron.
 */
export async function getExpiringDocuments(daysAhead = 30) {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);

    return prisma.vehicleDocument.findMany({
      where: { expiryDate: { not: null, lte: cutoff } },
      include: { vehicle: true },
      orderBy: { expiryDate: "asc" },
    });
  });
}
