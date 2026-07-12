// UI-layer types for the redesigned frontend (mock-data shape).
// NOTE: These are intentionally separate from the Prisma-backed types in
// `types/index.ts` (used by server actions). Field names/casing here match
// what the redesigned frontend components and lib/mockData.ts expect
// (e.g. `name` instead of `vehicleName`, lowercase status strings instead of
// the Prisma enum values). This file did not exist in the uploaded frontend
// zip — components imported "@/types" with no matching module, so this was
// added to fix that broken import without touching the real Prisma types
// used by the backend actions/services.

export type VehicleType = "truck" | "van" | "car" | "motorcycle" | "bus";
export type VehicleStatus = "available" | "on_trip" | "in_shop" | "retired";
export type LicenseCategory = "A" | "B" | "C" | "D" | "E";
export type DriverStatus = "available" | "on_trip" | "off_duty" | "suspended";
export type TripStatus = "draft" | "dispatched" | "completed" | "cancelled";
export type MaintenanceType =
  | "oil_change"
  | "brake_service"
  | "tire_rotation"
  | "general_inspection"
  | "engine_repair";
export type MaintenanceStatus = "scheduled" | "in_progress" | "completed";
export type ExpenseType = "toll" | "parking" | "maintenance" | "insurance" | "other";

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
  createdAt: Date;
}

export interface Vehicle {
  id: string;
  registrationNumber: string;
  name: string;
  model: string;
  type: VehicleType;
  capacity: number;
  odometer: number;
  acquisitionCost: number;
  status: VehicleStatus;
  lastServiceDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  licenseCategory: LicenseCategory;
  licenseExpiryDate: Date;
  contactNumber: string;
  safetyScore: number;
  status: DriverStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Trip {
  id: string;
  source: string;
  destination: string;
  vehicleId: string;
  driverId: string;
  cargoWeight: number;
  plannedDistance: number;
  actualDistance?: number;
  fuelUsed?: number;
  status: TripStatus;
  startTime?: Date;
  endTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaintenanceLog {
  id: string;
  vehicleId: string;
  maintenanceType: MaintenanceType;
  cost: number;
  date: Date;
  status: MaintenanceStatus;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FuelLog {
  id: string;
  vehicleId: string;
  liters: number;
  cost: number;
  date: Date;
  odometer: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Expense {
  id: string;
  vehicleId: string;
  expenseType: ExpenseType;
  amount: number;
  description: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}
