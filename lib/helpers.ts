import { Vehicle, Driver, Trip, MaintenanceLog, FuelLog, Expense } from "@/types/ui";

// Formatting utilities
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

export const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatDateTime = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatNumber = (num: number, decimals = 2): string => {
  return num.toFixed(decimals);
};

export const formatDistance = (km: number): string => {
  return `${km.toLocaleString()} km`;
};

export const formatWeight = (kg: number): string => {
  return `${kg.toLocaleString()} kg`;
};

export const formatFuel = (liters: number): string => {
  return `${liters.toFixed(2)} L`;
};

// Status badge styling
export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    // Vehicle statuses
    available: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
    on_trip: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
    in_shop: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
    retired: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
    // Driver statuses
    off_duty: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
    suspended: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
    // Trip statuses
    draft: "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
    dispatched: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100",
    completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100",
    cancelled: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100",
    // Maintenance statuses
    scheduled: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
    in_progress: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  };
  return colors[status] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100";
};

// Validation utilities
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, "").length >= 10;
};

export const isLicenseExpired = (expiryDate: Date): boolean => {
  return new Date(expiryDate) < new Date();
};

export const canAssignToTrip = (driver: Driver): boolean => {
  return driver.status === "available" && !isLicenseExpired(driver.licenseExpiryDate);
};

export const canDispatchVehicle = (vehicle: Vehicle): boolean => {
  return vehicle.status === "available";
};

// Calculation utilities
export const calculateFuelEfficiency = (distance: number, fuel: number): number => {
  if (fuel === 0) return 0;
  return parseFloat((distance / fuel).toFixed(2));
};

export const calculateOperationalCost = (
  fuelCost: number,
  maintenanceCost: number,
  expenseCost: number = 0
): number => {
  return fuelCost + maintenanceCost + expenseCost;
};

export const calculateVehicleROI = (
  acquisitionCost: number,
  revenue: number,
  totalCost: number
): number => {
  if (acquisitionCost === 0) return 0;
  return parseFloat((((revenue - totalCost) / acquisitionCost) * 100).toFixed(2));
};

export const calculateFleetUtilization = (activeVehicles: number, totalVehicles: number): number => {
  if (totalVehicles === 0) return 0;
  return parseFloat(((activeVehicles / totalVehicles) * 100).toFixed(2));
};

// Aggregation utilities
export const calculateTotalFuelCost = (fuelLogs: FuelLog[]): number => {
  return fuelLogs.reduce((sum, log) => sum + log.cost, 0);
};

export const calculateTotalMaintenanceCost = (maintenanceLogs: MaintenanceLog[]): number => {
  return maintenanceLogs.reduce((sum, log) => sum + log.cost, 0);
};

export const calculateTotalExpenses = (expenses: Expense[]): number => {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
};

export const calculateTotalDistance = (trips: Trip[]): number => {
  return trips
    .filter((trip) => trip.actualDistance)
    .reduce((sum, trip) => sum + (trip.actualDistance || 0), 0);
};

export const calculateTotalFuelUsed = (trips: Trip[]): number => {
  return trips
    .filter((trip) => trip.fuelUsed)
    .reduce((sum, trip) => sum + (trip.fuelUsed || 0), 0);
};

// CSV Export utilities
export const exportToCSV = (data: any[], filename: string): void => {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (typeof value === "string" && value.includes(",")) {
            return `"${value}"`;
          }
          return value;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Search and filter utilities
export const searchVehicles = (vehicles: Vehicle[], query: string): Vehicle[] => {
  const q = query.toLowerCase();
  return vehicles.filter(
    (v) =>
      v.registrationNumber.toLowerCase().includes(q) ||
      v.name.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q)
  );
};

export const searchDrivers = (drivers: Driver[], query: string): Driver[] => {
  const q = query.toLowerCase();
  return drivers.filter(
    (d) =>
      d.name.toLowerCase().includes(q) ||
      d.licenseNumber.toLowerCase().includes(q) ||
      d.contactNumber.includes(q)
  );
};

export const filterByStatus = <T extends { status: string }>(items: T[], status: string): T[] => {
  if (!status) return items;
  return items.filter((item) => item.status === status);
};

export const filterByDateRange = <T extends { date: Date }>(
  items: T[],
  from: Date,
  to: Date
): T[] => {
  return items.filter((item) => {
    const itemDate = new Date(item.date);
    return itemDate >= from && itemDate <= to;
  });
};

// Role-based utilities
export const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    admin: "Administrator",
    fleet_manager: "Fleet Manager",
    driver: "Driver",
    safety_officer: "Safety Officer",
    financial_analyst: "Financial Analyst",
  };
  return labels[role] || role;
};

// Generate mock ID
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Truncate text
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

// Get initials from name
export const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
};
