"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN_MANAGE_FLEET, CAN_VIEW_ALL } from "@/utils/rbac";
import { runAction, BusinessRuleError } from "@/utils/api-response";
import { createFuelLogSchema, CreateFuelLogInput } from "@/validations/fuel.schema";

export async function createFuelLog(input: CreateFuelLogInput) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_FLEET);
    const data = createFuelLogSchema.parse(input);

    const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
    if (!vehicle) throw new BusinessRuleError("Vehicle not found");

    const log = await prisma.fuelLog.create({ data });
    revalidatePath("/fuel-logs");
    return log;
  });
}

export async function getFuelLogs(filters?: { vehicleId?: string }) {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    return prisma.fuelLog.findMany({
      where: filters?.vehicleId ? { vehicleId: filters.vehicleId } : {},
      include: { vehicle: true },
      orderBy: { date: "desc" },
    });
  });
}
