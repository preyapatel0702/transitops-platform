"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN_MANAGE_FLEET, CAN_VIEW_ALL } from "@/utils/rbac";
import { runAction, BusinessRuleError } from "@/utils/api-response";
import {
  createVehicleSchema,
  updateVehicleSchema,
  CreateVehicleInput,
  UpdateVehicleInput,
} from "@/validations/vehicle.schema";

export async function createVehicle(input: CreateVehicleInput) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_FLEET);
    const data = createVehicleSchema.parse(input);

    const existing = await prisma.vehicle.findUnique({
      where: { registrationNumber: data.registrationNumber },
    });
    if (existing) {
      throw new BusinessRuleError("A vehicle with this registration number already exists");
    }

    const vehicle = await prisma.vehicle.create({ data });
    revalidatePath("/vehicles");
    return vehicle;
  });
}

const VEHICLE_SORT_FIELDS = [
  "createdAt",
  "registrationNumber",
  "vehicleName",
  "odometer",
  "acquisitionCost",
  "maxLoadCapacity",
] as const;

export async function getVehicles(filters?: {
  status?: string;
  search?: string;
  vehicleType?: string;
  region?: string;
  sortBy?: (typeof VEHICLE_SORT_FIELDS)[number];
  sortOrder?: "asc" | "desc";
}) {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);

    const sortBy = filters?.sortBy && VEHICLE_SORT_FIELDS.includes(filters.sortBy) ? filters.sortBy : "createdAt";
    const sortOrder = filters?.sortOrder === "asc" ? "asc" : "desc";

    return prisma.vehicle.findMany({
      where: {
        ...(filters?.status ? { status: filters.status as any } : {}),
        ...(filters?.vehicleType ? { vehicleType: filters.vehicleType } : {}),
        ...(filters?.region ? { region: filters.region } : {}),
        ...(filters?.search
          ? {
              OR: [
                { registrationNumber: { contains: filters.search, mode: "insensitive" } },
                { vehicleName: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { [sortBy]: sortOrder },
    });
  });
}

export async function getVehicleById(id: string) {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        trips: { orderBy: { createdAt: "desc" }, take: 10 },
        maintenanceLogs: { orderBy: { date: "desc" }, take: 10 },
        fuelLogs: { orderBy: { date: "desc" }, take: 10 },
        expenses: { orderBy: { date: "desc" }, take: 10 },
        documents: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!vehicle) throw new BusinessRuleError("Vehicle not found");

    const [fuelAgg, maintenanceAgg, expenseAgg] = await Promise.all([
      prisma.fuelLog.aggregate({ where: { vehicleId: id }, _sum: { cost: true } }),
      prisma.maintenanceLog.aggregate({ where: { vehicleId: id }, _sum: { cost: true } }),
      prisma.expense.aggregate({ where: { vehicleId: id }, _sum: { amount: true } }),
    ]);

    const totalFuelCost = fuelAgg._sum.cost ?? 0;
    const totalMaintenanceCost = maintenanceAgg._sum.cost ?? 0;
    const totalExpenseCost = expenseAgg._sum.amount ?? 0;

    return {
      ...vehicle,
      totalFuelCost,
      totalMaintenanceCost,
      totalExpenseCost,
      totalOperationalCost: totalFuelCost + totalMaintenanceCost + totalExpenseCost,
    };
  });
}

/**
 * Distinct vehicle types and regions currently in use — powers filter dropdowns.
 */
export async function getVehicleFilterOptions() {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    const [types, regions] = await Promise.all([
      prisma.vehicle.findMany({ distinct: ["vehicleType"], select: { vehicleType: true } }),
      prisma.vehicle.findMany({ distinct: ["region"], select: { region: true } }),
    ]);
    return {
      vehicleTypes: types.map((t: { vehicleType: string }) => t.vehicleType),
      regions: regions.map((r: { region: string }) => r.region),
    };
  });
}

/**
 * Vehicles eligible for dispatch: AVAILABLE status only.
 */
export async function getDispatchableVehicles() {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    return prisma.vehicle.findMany({
      where: { status: "AVAILABLE" },
      orderBy: { vehicleName: "asc" },
    });
  });
}

export async function updateVehicle(input: UpdateVehicleInput) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_FLEET);
    const data = updateVehicleSchema.parse(input);
    const { id, ...rest } = data;

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) throw new BusinessRuleError("Vehicle not found");

    if (rest.registrationNumber && rest.registrationNumber !== vehicle.registrationNumber) {
      const dup = await prisma.vehicle.findUnique({
        where: { registrationNumber: rest.registrationNumber },
      });
      if (dup) throw new BusinessRuleError("A vehicle with this registration number already exists");
    }

    const updated = await prisma.vehicle.update({ where: { id }, data: rest });
    revalidatePath("/vehicles");
    return updated;
  });
}

/**
 * Retires a vehicle permanently. Blocked while ON_TRIP; a vehicle IN_SHOP
 * can be retired directly (it will not return to AVAILABLE when maintenance closes).
 */
export async function retireVehicle(id: string) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_FLEET);
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) throw new BusinessRuleError("Vehicle not found");
    if (vehicle.status === "ON_TRIP") {
      throw new BusinessRuleError("Cannot retire a vehicle that is currently on a trip");
    }
    if (vehicle.status === "RETIRED") {
      throw new BusinessRuleError("Vehicle is already retired");
    }

    const updated = await prisma.vehicle.update({ where: { id }, data: { status: "RETIRED" } });
    revalidatePath("/vehicles");
    return updated;
  });
}

export async function deleteVehicle(id: string) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_FLEET);

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) throw new BusinessRuleError("Vehicle not found");

    if (vehicle.status === "ON_TRIP") {
      throw new BusinessRuleError("Cannot delete a vehicle that is currently on a trip");
    }

    await prisma.vehicle.delete({ where: { id } });
    revalidatePath("/vehicles");
    return { id };
  });
}
