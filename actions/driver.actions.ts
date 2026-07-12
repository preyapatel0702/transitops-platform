"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN_MANAGE_DRIVERS, CAN_VIEW_ALL } from "@/utils/rbac";
import { runAction, BusinessRuleError } from "@/utils/api-response";
import {
  createDriverSchema,
  updateDriverSchema,
  CreateDriverInput,
  UpdateDriverInput,
} from "@/validations/driver.schema";

export async function createDriver(input: CreateDriverInput) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_DRIVERS);
    const data = createDriverSchema.parse(input);

    const existing = await prisma.driver.findUnique({
      where: { licenseNumber: data.licenseNumber },
    });
    if (existing) {
      throw new BusinessRuleError("A driver with this license number already exists");
    }

    const driver = await prisma.driver.create({ data });
    revalidatePath("/drivers");
    return driver;
  });
}

const DRIVER_SORT_FIELDS = ["createdAt", "name", "licenseExpiryDate", "safetyScore"] as const;

export async function getDrivers(filters?: {
  status?: string;
  search?: string;
  sortBy?: (typeof DRIVER_SORT_FIELDS)[number];
  sortOrder?: "asc" | "desc";
}) {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);

    const sortBy = filters?.sortBy && DRIVER_SORT_FIELDS.includes(filters.sortBy) ? filters.sortBy : "createdAt";
    const sortOrder = filters?.sortOrder === "asc" ? "asc" : "desc";

    return prisma.driver.findMany({
      where: {
        ...(filters?.status ? { status: filters.status as any } : {}),
        ...(filters?.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: "insensitive" } },
                { licenseNumber: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { [sortBy]: sortOrder },
    });
  });
}

export async function getDriverById(id: string) {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    const driver = await prisma.driver.findUnique({
      where: { id },
      include: {
        trips: { orderBy: { createdAt: "desc" }, take: 10, include: { vehicle: true } },
      },
    });
    if (!driver) throw new BusinessRuleError("Driver not found");
    return driver;
  });
}

/**
 * Drivers eligible for dispatch: AVAILABLE status and non-expired license.
 */
export async function getDispatchableDrivers() {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    return prisma.driver.findMany({
      where: {
        status: "AVAILABLE",
        licenseExpiryDate: { gt: new Date() },
      },
      orderBy: { name: "asc" },
    });
  });
}

/**
 * Drivers whose license expires within `daysAhead` days (default 30) —
 * powers compliance banners and the email reminder cron.
 */
export async function getExpiringLicenses(daysAhead = 30) {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);

    return prisma.driver.findMany({
      where: { licenseExpiryDate: { lte: cutoff } },
      orderBy: { licenseExpiryDate: "asc" },
    });
  });
}

export async function updateDriver(input: UpdateDriverInput) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_DRIVERS);
    const data = updateDriverSchema.parse(input);
    const { id, ...rest } = data;

    const driver = await prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new BusinessRuleError("Driver not found");

    if (rest.licenseNumber && rest.licenseNumber !== driver.licenseNumber) {
      const dup = await prisma.driver.findUnique({ where: { licenseNumber: rest.licenseNumber } });
      if (dup) throw new BusinessRuleError("A driver with this license number already exists");
    }

    const updated = await prisma.driver.update({ where: { id }, data: rest });
    revalidatePath("/drivers");
    return updated;
  });
}

export async function deleteDriver(id: string) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_DRIVERS);

    const driver = await prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new BusinessRuleError("Driver not found");

    if (driver.status === "ON_TRIP") {
      throw new BusinessRuleError("Cannot delete a driver who is currently on a trip");
    }

    await prisma.driver.delete({ where: { id } });
    revalidatePath("/drivers");
    return { id };
  });
}
