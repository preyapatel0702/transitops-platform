import { PrismaClient, VehicleStatus, DriverStatus, TripStatus, ExpenseType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const VEHICLE_TYPES = ["Truck", "Van", "Trailer", "Pickup"];
const CITIES = [
  "Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata",
  "Hyderabad", "Pune", "Ahmedabad", "Surat", "Jaipur",
];

function randomOf<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFloat(min: number, max: number, decimals = 2) {
  return Number((Math.random() * (max - min) + min).toFixed(decimals));
}

async function main() {
  console.log("Seeding database...");

  const password = await bcrypt.hash("Password123!", 10);

  await prisma.user.createMany({
    data: [
      { name: "Alex Admin", email: "admin@transitops.com", password, role: "ADMIN" },
      { name: "Frank Fleet", email: "fleet@transitops.com", password, role: "FLEET_MANAGER" },
      { name: "Sam Safety", email: "safety@transitops.com", password, role: "SAFETY_OFFICER" },
      { name: "Fiona Finance", email: "finance@transitops.com", password, role: "FINANCIAL_ANALYST" },
    ],
    skipDuplicates: true,
  });

  const vehicles = [];
  for (let i = 1; i <= 10; i++) {
    const vehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: `TN-${1000 + i}`,
        vehicleName: `Fleet Unit ${i}`,
        model: `Model-${randomOf(["X200", "Y450", "Z100", "T900"])}`,
        vehicleType: randomOf(VEHICLE_TYPES),
        region: randomOf(CITIES),
        maxLoadCapacity: randomFloat(1000, 15000, 0),
        odometer: randomFloat(500, 80000, 1),
        acquisitionCost: randomFloat(15000, 90000, 2),
        status: i <= 7 ? VehicleStatus.AVAILABLE : i === 8 ? VehicleStatus.IN_SHOP : VehicleStatus.AVAILABLE,
      },
    });
    vehicles.push(vehicle);
  }

  const drivers = [];
  for (let i = 1; i <= 10; i++) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + (i === 10 ? -30 : 365));
    const driver = await prisma.driver.create({
      data: {
        name: `Driver ${i}`,
        licenseNumber: `LIC-${5000 + i}`,
        licenseCategory: randomOf(["LMV", "HMV", "Commercial"]),
        licenseExpiryDate: expiry,
        contactNumber: `9${String(100000000 + i).padStart(9, "0")}`,
        safetyScore: randomFloat(60, 100, 1),
        status: i === 9 ? DriverStatus.SUSPENDED : DriverStatus.AVAILABLE,
      },
    });
    drivers.push(driver);
  }

  for (let i = 1; i <= 20; i++) {
    const vehicle = randomOf(vehicles.filter((v) => v.status !== "IN_SHOP"));
    const driver = randomOf(drivers.filter((d) => d.status === "AVAILABLE"));
    const isCompleted = i <= 14;
    const isCancelled = i > 14 && i <= 16;
    const plannedDistance = randomFloat(50, 1200, 1);

    const status: TripStatus = isCompleted
      ? TripStatus.COMPLETED
      : isCancelled
      ? TripStatus.CANCELLED
      : TripStatus.DRAFT;

    await prisma.trip.create({
      data: {
        vehicleId: vehicle.id,
        driverId: driver.id,
        source: randomOf(CITIES),
        destination: randomOf(CITIES),
        cargoWeight: randomFloat(200, Math.min(vehicle.maxLoadCapacity, 8000), 0),
        plannedDistance,
        actualDistance: isCompleted ? plannedDistance + randomFloat(-10, 30, 1) : null,
        fuelUsed: isCompleted ? randomFloat(20, 200, 1) : null,
        revenue: isCompleted ? randomFloat(500, 5000, 2) : null,
        startTime: isCompleted || isCancelled ? new Date(Date.now() - randomFloat(1, 20) * 86400000) : null,
        endTime: isCompleted ? new Date() : null,
        status,
      },
    });
  }

  const maintenanceTypes = ["Oil Change", "Brake Repair", "Tire Replacement", "Engine Service", "AC Repair"];
  for (let i = 0; i < 5; i++) {
    await prisma.maintenanceLog.create({
      data: {
        vehicleId: vehicles[i].id,
        maintenanceType: maintenanceTypes[i],
        description: `${maintenanceTypes[i]} performed on ${vehicles[i].vehicleName}`,
        cost: randomFloat(100, 2000, 2),
        date: new Date(Date.now() - randomFloat(1, 60) * 86400000),
        status: i === 0 ? "ACTIVE" : "COMPLETED",
      },
    });
  }

  for (let i = 0; i < 10; i++) {
    await prisma.fuelLog.create({
      data: {
        vehicleId: randomOf(vehicles).id,
        liters: randomFloat(20, 300, 1),
        cost: randomFloat(50, 500, 2),
        date: new Date(Date.now() - randomFloat(1, 45) * 86400000),
      },
    });
  }

  const expenseTypes: ExpenseType[] = ["TOLL", "MAINTENANCE", "INSURANCE", "OTHER"];
  for (let i = 0; i < 10; i++) {
    await prisma.expense.create({
      data: {
        vehicleId: randomOf(vehicles).id,
        expenseType: randomOf(expenseTypes),
        amount: randomFloat(20, 1500, 2),
        description: `Expense record ${i + 1}`,
        date: new Date(Date.now() - randomFloat(1, 45) * 86400000),
      },
    });
  }

  const docTypes: ("REGISTRATION_CERTIFICATE" | "INSURANCE" | "PERMIT" | "POLLUTION_CERTIFICATE")[] = [
    "REGISTRATION_CERTIFICATE",
    "INSURANCE",
    "PERMIT",
    "POLLUTION_CERTIFICATE",
  ];
  for (let i = 0; i < vehicles.length; i++) {
    const docType = docTypes[i % docTypes.length];
    // First 3 vehicles get a document expiring within 10 days to demo the reminder job.
    const expiryOffsetDays = i < 3 ? randomFloat(-2, 10, 0) : randomFloat(30, 365, 0);
    await prisma.vehicleDocument.create({
      data: {
        vehicleId: vehicles[i].id,
        docType,
        documentNumber: `DOC-${1000 + i}`,
        documentUrl: `https://example-storage.com/documents/${vehicles[i].registrationNumber}-${docType}.pdf`,
        expiryDate: new Date(Date.now() + expiryOffsetDays * 86400000),
      },
    });
  }

  console.log("Seeding complete.");
  console.log("Login credentials (all roles share password: Password123!):");
  console.log(" admin@transitops.com | fleet@transitops.com | safety@transitops.com | finance@transitops.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
