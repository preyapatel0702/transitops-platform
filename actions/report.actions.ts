"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, CAN_VIEW_ALL } from "@/utils/rbac";
import { runAction } from "@/utils/api-response";
import { getDashboardKPIs, getVehicleROIBreakdown } from "@/services/dashboard.service";

export async function getVehiclesReport() {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    return prisma.vehicle.findMany({
      include: {
        _count: { select: { trips: true, maintenanceLogs: true, fuelLogs: true, expenses: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function getDriversReport() {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    return prisma.driver.findMany({
      include: { _count: { select: { trips: true } } },
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function getTripsReport(filters?: { status?: string; from?: Date; to?: Date }) {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    return prisma.trip.findMany({
      where: {
        ...(filters?.status ? { status: filters.status as any } : {}),
        ...(filters?.from || filters?.to
          ? {
              createdAt: {
                ...(filters?.from ? { gte: filters.from } : {}),
                ...(filters?.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
      include: { vehicle: true, driver: true },
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function getMaintenanceReport() {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    const [logs, totalCost] = await Promise.all([
      prisma.maintenanceLog.findMany({ include: { vehicle: true }, orderBy: { date: "desc" } }),
      prisma.maintenanceLog.aggregate({ _sum: { cost: true } }),
    ]);
    return { logs, totalCost: totalCost._sum.cost ?? 0 };
  });
}

export async function getFuelReport() {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    const [logs, totals] = await Promise.all([
      prisma.fuelLog.findMany({ include: { vehicle: true }, orderBy: { date: "desc" } }),
      prisma.fuelLog.aggregate({ _sum: { liters: true, cost: true } }),
    ]);
    return {
      logs,
      totalLiters: totals._sum.liters ?? 0,
      totalCost: totals._sum.cost ?? 0,
    };
  });
}

export async function getExpenseReport() {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    const [expenses, byType] = await Promise.all([
      prisma.expense.findMany({ include: { vehicle: true }, orderBy: { date: "desc" } }),
      prisma.expense.groupBy({ by: ["expenseType"], _sum: { amount: true } }),
    ]);
    return { expenses, byType };
  });
}

export async function getAnalyticsReport() {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    const [kpis, roiBreakdown] = await Promise.all([
      getDashboardKPIs(),
      getVehicleROIBreakdown(),
    ]);
    return { kpis, roiBreakdown };
  });
}
