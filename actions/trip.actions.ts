"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN_MANAGE_TRIPS, CAN_VIEW_ALL } from "@/utils/rbac";
import { runAction, BusinessRuleError } from "@/utils/api-response";
import {
  createTripSchema,
  updateTripSchema,
  completeTripSchema,
  cancelTripSchema,
  CreateTripInput,
  UpdateTripInput,
  CompleteTripInput,
  CancelTripInput,
} from "@/validations/trip.schema";

/**
 * Create a trip in DRAFT status. No vehicle/driver state changes yet.
 */
export async function createTrip(input: CreateTripInput) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_TRIPS);
    const data = createTripSchema.parse(input);

    const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
    if (!vehicle) throw new BusinessRuleError("Vehicle not found");

    if (data.cargoWeight > vehicle.maxLoadCapacity) {
      throw new BusinessRuleError(
        `Cargo weight (${data.cargoWeight}) exceeds vehicle max capacity (${vehicle.maxLoadCapacity})`
      );
    }

    const driver = await prisma.driver.findUnique({ where: { id: data.driverId } });
    if (!driver) throw new BusinessRuleError("Driver not found");

    const trip = await prisma.trip.create({ data: { ...data, status: "DRAFT" } });
    revalidatePath("/trips");
    return trip;
  });
}

const TRIP_SORT_FIELDS = ["createdAt", "plannedDistance", "cargoWeight", "revenue"] as const;

export async function getTrips(filters?: {
  status?: string;
  search?: string;
  sortBy?: (typeof TRIP_SORT_FIELDS)[number];
  sortOrder?: "asc" | "desc";
}) {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);

    const sortBy = filters?.sortBy && TRIP_SORT_FIELDS.includes(filters.sortBy) ? filters.sortBy : "createdAt";
    const sortOrder = filters?.sortOrder === "asc" ? "asc" : "desc";

    return prisma.trip.findMany({
      where: {
        ...(filters?.status ? { status: filters.status as any } : {}),
        ...(filters?.search
          ? {
              OR: [
                { source: { contains: filters.search, mode: "insensitive" } },
                { destination: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { vehicle: true, driver: true },
      orderBy: { [sortBy]: sortOrder },
    });
  });
}

export async function getTripById(id: string) {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { vehicle: true, driver: true },
    });
    if (!trip) throw new BusinessRuleError("Trip not found");
    return trip;
  });
}

export async function updateTrip(input: UpdateTripInput) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_TRIPS);
    const data = updateTripSchema.parse(input);
    const { id, ...rest } = data;

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) throw new BusinessRuleError("Trip not found");
    if (trip.status !== "DRAFT") {
      throw new BusinessRuleError("Only DRAFT trips can be edited");
    }

    if (rest.cargoWeight !== undefined) {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: trip.vehicleId } });
      if (vehicle && rest.cargoWeight > vehicle.maxLoadCapacity) {
        throw new BusinessRuleError(
          `Cargo weight (${rest.cargoWeight}) exceeds vehicle max capacity (${vehicle.maxLoadCapacity})`
        );
      }
    }

    const updated = await prisma.trip.update({ where: { id }, data: rest });
    revalidatePath("/trips");
    return updated;
  });
}

/**
 * Dispatch a DRAFT trip: validates vehicle/driver eligibility, then
 * transitions Vehicle -> ON_TRIP, Driver -> ON_TRIP, Trip -> DISPATCHED.
 */
export async function dispatchTrip(id: string) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_TRIPS);

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { vehicle: true, driver: true },
    });
    if (!trip) throw new BusinessRuleError("Trip not found");
    if (trip.status !== "DRAFT") {
      throw new BusinessRuleError("Only DRAFT trips can be dispatched");
    }

    const { vehicle, driver } = trip;

    if (vehicle.status === "RETIRED") throw new BusinessRuleError("Vehicle is retired and cannot be dispatched");
    if (vehicle.status === "IN_SHOP") throw new BusinessRuleError("Vehicle is in shop and cannot be dispatched");
    if (vehicle.status === "ON_TRIP") throw new BusinessRuleError("Vehicle is already on a trip");
    if (vehicle.status !== "AVAILABLE") throw new BusinessRuleError("Vehicle is not available for dispatch");

    if (driver.status === "SUSPENDED") throw new BusinessRuleError("Driver is suspended and cannot be dispatched");
    if (driver.status === "ON_TRIP") throw new BusinessRuleError("Driver is already on a trip");
    if (driver.status !== "AVAILABLE") throw new BusinessRuleError("Driver is not available for dispatch");
    if (driver.licenseExpiryDate <= new Date()) {
      throw new BusinessRuleError("Driver's license has expired and cannot be dispatched");
    }

    if (trip.cargoWeight > vehicle.maxLoadCapacity) {
      throw new BusinessRuleError(
        `Cargo weight (${trip.cargoWeight}) exceeds vehicle max capacity (${vehicle.maxLoadCapacity})`
      );
    }

    const [, , updatedTrip] = await prisma.$transaction([
      prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: "ON_TRIP" } }),
      prisma.driver.update({ where: { id: driver.id }, data: { status: "ON_TRIP" } }),
      prisma.trip.update({
        where: { id },
        data: { status: "DISPATCHED", startTime: new Date() },
      }),
    ]);

    revalidatePath("/trips");
    revalidatePath("/vehicles");
    revalidatePath("/drivers");
    return updatedTrip;
  });
}

/**
 * Complete a DISPATCHED trip: updates vehicle odometer, creates a fuel log,
 * and returns Vehicle & Driver to AVAILABLE.
 */
export async function completeTrip(input: CompleteTripInput) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_TRIPS);
    const data = completeTripSchema.parse(input);

    const trip = await prisma.trip.findUnique({
      where: { id: data.id },
      include: { vehicle: true },
    });
    if (!trip) throw new BusinessRuleError("Trip not found");
    if (trip.status !== "DISPATCHED") {
      throw new BusinessRuleError("Only DISPATCHED trips can be completed");
    }

    if (data.finalOdometer < trip.vehicle.odometer) {
      throw new BusinessRuleError("Final odometer cannot be less than current odometer");
    }

    const distance = data.actualDistance;

    const [, , , updatedTrip] = await prisma.$transaction([
      prisma.vehicle.update({
        where: { id: trip.vehicleId },
        data: { odometer: data.finalOdometer, status: "AVAILABLE" },
      }),
      prisma.driver.update({ where: { id: trip.driverId }, data: { status: "AVAILABLE" } }),
      prisma.fuelLog.create({
        data: {
          vehicleId: trip.vehicleId,
          liters: data.fuelUsed,
          cost: data.fuelCost,
          date: new Date(),
        },
      }),
      prisma.trip.update({
        where: { id: data.id },
        data: {
          status: "COMPLETED",
          actualDistance: distance,
          fuelUsed: data.fuelUsed,
          endTime: new Date(),
        },
      }),
    ]);

    revalidatePath("/trips");
    revalidatePath("/vehicles");
    revalidatePath("/drivers");
    revalidatePath("/dashboard");
    return updatedTrip;
  });
}

/**
 * Cancel a DISPATCHED trip: returns Vehicle & Driver to AVAILABLE.
 */
export async function cancelTrip(input: CancelTripInput) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_TRIPS);
    const data = cancelTripSchema.parse(input);

    const trip = await prisma.trip.findUnique({ where: { id: data.id } });
    if (!trip) throw new BusinessRuleError("Trip not found");
    if (trip.status !== "DISPATCHED" && trip.status !== "DRAFT") {
      throw new BusinessRuleError("Only DRAFT or DISPATCHED trips can be cancelled");
    }

    const wasDispatched = trip.status === "DISPATCHED";

    const ops = [
      prisma.trip.update({ where: { id: data.id }, data: { status: "CANCELLED" } }),
    ];

    if (wasDispatched) {
      ops.push(
        prisma.vehicle.update({ where: { id: trip.vehicleId }, data: { status: "AVAILABLE" } }) as any,
        prisma.driver.update({ where: { id: trip.driverId }, data: { status: "AVAILABLE" } }) as any
      );
    }

    const [updatedTrip] = await prisma.$transaction(ops as any);

    revalidatePath("/trips");
    revalidatePath("/vehicles");
    revalidatePath("/drivers");
    return updatedTrip;
  });
}
