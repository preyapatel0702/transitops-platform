"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN_MANAGE_MAINTENANCE, CAN_VIEW_ALL } from "@/utils/rbac";
import { runAction, BusinessRuleError } from "@/utils/api-response";
import {
  createMaintenanceSchema,
  closeMaintenanceSchema,
  CreateMaintenanceInput,
  CloseMaintenanceInput,
} from "@/validations/maintenance.schema";

/**
 * Creates an ACTIVE maintenance record and moves the vehicle to IN_SHOP,
 * removing it from dispatch eligibility.
 */
export async function createMaintenance(input: CreateMaintenanceInput) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_MAINTENANCE);
    const data = createMaintenanceSchema.parse(input);

    const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
    if (!vehicle) throw new BusinessRuleError("Vehicle not found");
    if (vehicle.status === "ON_TRIP") {
      throw new BusinessRuleError("Cannot send a vehicle to maintenance while it is on a trip");
    }
    if (vehicle.status === "RETIRED") {
      throw new BusinessRuleError("Cannot send a retired vehicle to maintenance");
    }

    const [, log] = await prisma.$transaction([
      prisma.vehicle.update({ where: { id: data.vehicleId }, data: { status: "IN_SHOP" } }),
      prisma.maintenanceLog.create({ data: { ...data, status: "ACTIVE" } }),
    ]);

    revalidatePath("/maintenance");
    revalidatePath("/vehicles");
    return log;
  });
}

export async function getMaintenanceLogs(filters?: { status?: string; vehicleId?: string }) {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    return prisma.maintenanceLog.findMany({
      where: {
        ...(filters?.status ? { status: filters.status as any } : {}),
        ...(filters?.vehicleId ? { vehicleId: filters.vehicleId } : {}),
      },
      include: { vehicle: true },
      orderBy: { date: "desc" },
    });
  });
}

/**
 * Closes an ACTIVE maintenance record. Vehicle returns to AVAILABLE
 * unless it was explicitly RETIRED, in which case it stays RETIRED.
 */
export async function closeMaintenance(input: CloseMaintenanceInput) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_MAINTENANCE);
    const data = closeMaintenanceSchema.parse(input);

    const log = await prisma.maintenanceLog.findUnique({
      where: { id: data.id },
      include: { vehicle: true },
    });
    if (!log) throw new BusinessRuleError("Maintenance record not found");
    if (log.status !== "ACTIVE") throw new BusinessRuleError("Maintenance record is already closed");

    const nextVehicleStatus = log.vehicle.status === "RETIRED" ? "RETIRED" : "AVAILABLE";

    const [, updatedLog] = await prisma.$transaction([
      prisma.vehicle.update({ where: { id: log.vehicleId }, data: { status: nextVehicleStatus } }),
      prisma.maintenanceLog.update({ where: { id: data.id }, data: { status: "COMPLETED" } }),
    ]);

    revalidatePath("/maintenance");
    revalidatePath("/vehicles");
    return updatedLog;
  });
}
