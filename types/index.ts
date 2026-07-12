import type {
  User,
  Vehicle,
  Driver,
  Trip,
  MaintenanceLog,
  FuelLog,
  Expense,
  VehicleDocument,
  Role,
  VehicleStatus,
  DriverStatus,
  TripStatus,
  MaintenanceStatus,
  ExpenseType,
  DocumentType,
} from "@prisma/client";

export type {
  User,
  Vehicle,
  Driver,
  Trip,
  MaintenanceLog,
  FuelLog,
  Expense,
  VehicleDocument,
  Role,
  VehicleStatus,
  DriverStatus,
  TripStatus,
  MaintenanceStatus,
  ExpenseType,
  DocumentType,
};

export type TripWithRelations = Trip & { vehicle: Vehicle; driver: Driver };
export type VehicleWithRelations = Vehicle & {
  trips: Trip[];
  maintenanceLogs: MaintenanceLog[];
  fuelLogs: FuelLog[];
  expenses: Expense[];
};
export type DriverWithTrips = Driver & { trips: Trip[] };
