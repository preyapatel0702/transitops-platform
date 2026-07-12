import { prisma } from "@/lib/prisma";

export interface DashboardKPIs {
  totalVehicles: number;
  activeVehicles: number; // AVAILABLE + ON_TRIP + IN_SHOP (not retired)
  availableVehicles: number;
  vehiclesInShop: number;
  vehiclesOnTrip: number;
  activeTrips: number; // DISPATCHED
  pendingTrips: number; // DRAFT
  totalDrivers: number;
  driversOnDuty: number; // ON_TRIP
  fleetUtilization: number; // percentage
  fuelEfficiency: number; // distance / fuel used, across completed trips
  totalOperationalCost: number; // fuel + maintenance + other expenses
  totalRevenue: number;
  fleetROI: number; // (revenue - (fuel + maintenance)) / acquisition cost
  licensesExpiringSoon: number; // license expires within 30 days, not yet expired
  licensesExpired: number;
  documentsExpiringSoon: number; // vehicle documents expiring within 30 days, not yet expired
  documentsExpired: number;
}

export interface DashboardFilters {
  vehicleType?: string;
  status?: string;
  region?: string;
}

/**
 * Single-pass dashboard aggregation. Uses Prisma groupBy/aggregate to avoid
 * N+1 queries and in-memory loops over full tables.
 * Filters (vehicleType/status/region) scope vehicle- and trip-derived metrics.
 * Driver-only metrics (totalDrivers, driversOnDuty) are unaffected since
 * drivers have no vehicleType/region attributes.
 */
export async function getDashboardKPIs(filters?: DashboardFilters): Promise<DashboardKPIs> {
  const vehicleWhere = {
    ...(filters?.status ? { status: filters.status as any } : {}),
    ...(filters?.vehicleType ? { vehicleType: filters.vehicleType } : {}),
    ...(filters?.region ? { region: filters.region } : {}),
  };
  const tripWhere = Object.keys(vehicleWhere).length ? { vehicle: vehicleWhere } : {};
  const now = new Date();
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);

  const [
    totalVehicles,
    vehiclesByStatus,
    tripsByStatus,
    totalDrivers,
    driversByStatus,
    completedTripsAgg,
    fuelAgg,
    maintenanceAgg,
    expenseAgg,
    revenueAgg,
    acquisitionCostAgg,
    licensesExpiringSoon,
    licensesExpired,
    documentsExpiringSoon,
    documentsExpired,
  ] = await Promise.all([
    prisma.vehicle.count({ where: vehicleWhere }),
    prisma.vehicle.groupBy({ by: ["status"], where: vehicleWhere, _count: { status: true } }),
    prisma.trip.groupBy({ by: ["status"], where: tripWhere, _count: { status: true } }),
    prisma.driver.count(),
    prisma.driver.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.trip.aggregate({
      where: { status: "COMPLETED", ...tripWhere },
      _sum: { actualDistance: true, fuelUsed: true, revenue: true },
    }),
    prisma.fuelLog.aggregate({ where: { vehicle: vehicleWhere }, _sum: { cost: true } }),
    prisma.maintenanceLog.aggregate({ where: { vehicle: vehicleWhere }, _sum: { cost: true } }),
    prisma.expense.aggregate({ where: { vehicle: vehicleWhere }, _sum: { amount: true } }),
    prisma.trip.aggregate({ where: { status: "COMPLETED", ...tripWhere }, _sum: { revenue: true } }),
    prisma.vehicle.aggregate({ where: vehicleWhere, _sum: { acquisitionCost: true } }),
    prisma.driver.count({ where: { licenseExpiryDate: { gte: now, lte: in30Days } } }),
    prisma.driver.count({ where: { licenseExpiryDate: { lt: now } } }),
    prisma.vehicleDocument.count({
      where: { vehicle: vehicleWhere, expiryDate: { not: null, gte: now, lte: in30Days } },
    }),
    prisma.vehicleDocument.count({
      where: { vehicle: vehicleWhere, expiryDate: { not: null, lt: now } },
    }),
  ]);

  const statusCount = (rows: { status: string; _count: { status: number } }[], status: string) =>
    rows.find((r) => r.status === status)?._count.status ?? 0;

  const available = statusCount(vehiclesByStatus as any, "AVAILABLE");
  const onTrip = statusCount(vehiclesByStatus as any, "ON_TRIP");
  const inShop = statusCount(vehiclesByStatus as any, "IN_SHOP");
  const retired = statusCount(vehiclesByStatus as any, "RETIRED");

  const dispatched = statusCount(tripsByStatus as any, "DISPATCHED");
  const draft = statusCount(tripsByStatus as any, "DRAFT");

  const driversOnDuty = statusCount(driversByStatus as any, "ON_TRIP");

  const activeVehicles = totalVehicles - retired;
  const fleetUtilization = totalVehicles > 0 ? (onTrip / totalVehicles) * 100 : 0;

  const totalDistance = completedTripsAgg._sum.actualDistance ?? 0;
  const totalFuelUsed = completedTripsAgg._sum.fuelUsed ?? 0;
  const fuelEfficiency = totalFuelUsed > 0 ? totalDistance / totalFuelUsed : 0;

  const fuelCost = fuelAgg._sum.cost ?? 0;
  const maintenanceCost = maintenanceAgg._sum.cost ?? 0;
  const otherExpenses = expenseAgg._sum.amount ?? 0;
  const totalOperationalCost = fuelCost + maintenanceCost + otherExpenses;

  const totalRevenue = revenueAgg._sum.revenue ?? 0;
  const totalAcquisitionCost = acquisitionCostAgg._sum.acquisitionCost ?? 0;
  const fleetROI =
    totalAcquisitionCost > 0
      ? (totalRevenue - (fuelCost + maintenanceCost)) / totalAcquisitionCost
      : 0;

  return {
    totalVehicles,
    activeVehicles,
    availableVehicles: available,
    vehiclesInShop: inShop,
    vehiclesOnTrip: onTrip,
    activeTrips: dispatched,
    pendingTrips: draft,
    totalDrivers,
    driversOnDuty,
    fleetUtilization: Number(fleetUtilization.toFixed(2)),
    fuelEfficiency: Number(fuelEfficiency.toFixed(2)),
    totalOperationalCost: Number(totalOperationalCost.toFixed(2)),
    totalRevenue: Number(totalRevenue.toFixed(2)),
    fleetROI: Number(fleetROI.toFixed(4)),
    licensesExpiringSoon,
    licensesExpired,
    documentsExpiringSoon,
    documentsExpired,
  };
}

/**
 * Per-vehicle ROI breakdown: (revenue - (fuel + maintenance)) / acquisitionCost
 */
export async function getVehicleROIBreakdown() {
  const vehicles = await prisma.vehicle.findMany({
    select: {
      id: true,
      registrationNumber: true,
      vehicleName: true,
      acquisitionCost: true,
      trips: { where: { status: "COMPLETED" }, select: { revenue: true } },
      fuelLogs: { select: { cost: true } },
      maintenanceLogs: { select: { cost: true } },
    },
  });

  return vehicles.map((v: (typeof vehicles)[number]) => {
    const revenue = v.trips.reduce((sum: number, t: { revenue: number | null }) => sum + (t.revenue ?? 0), 0);
    const fuelCost = v.fuelLogs.reduce((sum: number, f: { cost: number }) => sum + f.cost, 0);
    const maintenanceCost = v.maintenanceLogs.reduce((sum: number, m: { cost: number }) => sum + m.cost, 0);
    const roi =
      v.acquisitionCost > 0 ? (revenue - (fuelCost + maintenanceCost)) / v.acquisitionCost : 0;

    return {
      vehicleId: v.id,
      registrationNumber: v.registrationNumber,
      vehicleName: v.vehicleName,
      revenue: Number(revenue.toFixed(2)),
      fuelCost: Number(fuelCost.toFixed(2)),
      maintenanceCost: Number(maintenanceCost.toFixed(2)),
      roi: Number(roi.toFixed(4)),
    };
  });
}
