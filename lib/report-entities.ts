import { prisma } from "@/lib/prisma";
import { getDashboardKPIs } from "@/services/dashboard.service";

export const ENTITY_HANDLERS: Record<string, () => Promise<Record<string, unknown>[]>> = {
  vehicles: async () => {
    const rows = await prisma.vehicle.findMany({ orderBy: { createdAt: "desc" } });
    return rows as unknown as Record<string, unknown>[];
  },
  drivers: async () => {
    const rows = await prisma.driver.findMany({ orderBy: { createdAt: "desc" } });
    return rows as unknown as Record<string, unknown>[];
  },
  trips: async () => {
    const rows = await prisma.trip.findMany({
      include: { vehicle: true, driver: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((t: typeof rows[number]) => ({
      id: t.id,
      vehicleRegistration: t.vehicle.registrationNumber,
      driverName: t.driver.name,
      source: t.source,
      destination: t.destination,
      cargoWeight: t.cargoWeight,
      plannedDistance: t.plannedDistance,
      actualDistance: t.actualDistance,
      fuelUsed: t.fuelUsed,
      revenue: t.revenue,
      status: t.status,
      startTime: t.startTime,
      endTime: t.endTime,
      createdAt: t.createdAt,
    }));
  },
  maintenance: async () => {
    const rows = await prisma.maintenanceLog.findMany({
      include: { vehicle: true },
      orderBy: { date: "desc" },
    });
    return rows.map((m: typeof rows[number]) => ({
      id: m.id,
      vehicleRegistration: m.vehicle.registrationNumber,
      maintenanceType: m.maintenanceType,
      description: m.description,
      cost: m.cost,
      date: m.date,
      status: m.status,
    }));
  },
  fuel: async () => {
    const rows = await prisma.fuelLog.findMany({
      include: { vehicle: true },
      orderBy: { date: "desc" },
    });
    return rows.map((f: typeof rows[number]) => ({
      id: f.id,
      vehicleRegistration: f.vehicle.registrationNumber,
      liters: f.liters,
      cost: f.cost,
      date: f.date,
    }));
  },
  expenses: async () => {
    const rows = await prisma.expense.findMany({
      include: { vehicle: true },
      orderBy: { date: "desc" },
    });
    return rows.map((e: typeof rows[number]) => ({
      id: e.id,
      vehicleRegistration: e.vehicle.registrationNumber,
      expenseType: e.expenseType,
      amount: e.amount,
      description: e.description,
      date: e.date,
    }));
  },
  documents: async () => {
    const rows = await prisma.vehicleDocument.findMany({
      include: { vehicle: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((d: typeof rows[number]) => ({
      id: d.id,
      vehicleRegistration: d.vehicle.registrationNumber,
      docType: d.docType,
      documentNumber: d.documentNumber,
      expiryDate: d.expiryDate,
      createdAt: d.createdAt,
    }));
  },
  dashboard: async () => {
    const kpis = await getDashboardKPIs();
    return [kpis as unknown as Record<string, unknown>];
  },
};
