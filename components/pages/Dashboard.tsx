"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Truck,
  Users,
  Navigation,
  AlertCircle,
  Fuel,
  DollarSign,
  Zap,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardData, getVehicleROIData } from "@/actions/dashboard.actions";
import { getVehicleFilterOptions } from "@/actions/vehicle.actions";
import { getTrips } from "@/actions/trip.actions";
import { getExpiringLicenses } from "@/actions/driver.actions";
import type { DashboardKPIs, getVehicleROIBreakdown } from "@/services/dashboard.service";
import { formatCurrency, formatDate } from "@/lib/helpers";

const VEHICLE_STATUS_COLORS: Record<string, string> = {
  Available: "#10b981",
  "On Trip": "#3b82f6",
  "In Shop": "#f59e0b",
  Retired: "#6b7280",
};

const TRIP_STATUS_COLORS: Record<string, string> = {
  Draft: "#6b7280",
  Dispatched: "#3b82f6",
  Completed: "#10b981",
  Cancelled: "#f43f5e",
};

interface DashFilters {
  vehicleType?: string;
  status?: string;
  region?: string;
}

export default function Dashboard() {
  const { user, logout } = useAuth();

  const [filters, setFilters] = useState<DashFilters>({});
  const [filterOptions, setFilterOptions] = useState<{ vehicleTypes: string[]; regions: string[] }>({
    vehicleTypes: [],
    regions: [],
  });

  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [roi, setRoi] = useState<Awaited<ReturnType<typeof getVehicleROIBreakdown>>>([]);
  const [tripStatusCounts, setTripStatusCounts] = useState<Record<string, number>>({});
  const [expiringLicenses, setExpiringLicenses] = useState<
    { id: string; name: string; licenseExpiryDate: Date }[]
  >([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getVehicleFilterOptions().then((res) => {
      if (res.success) setFilterOptions(res.data);
    });
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const [kpiRes, roiRes, tripsRes, licensesRes] = await Promise.all([
      getDashboardData(filters),
      getVehicleROIData(),
      getTrips({}),
      getExpiringLicenses(30),
    ]);

    if (!kpiRes.success) {
      setError(kpiRes.error);
      setIsLoading(false);
      return;
    }
    setKpis(kpiRes.data);
    if (roiRes.success) setRoi(roiRes.data);
    if (tripsRes.success) {
      const counts: Record<string, number> = { Draft: 0, Dispatched: 0, Completed: 0, Cancelled: 0 };
      for (const t of tripsRes.data) {
        const label = t.status.charAt(0) + t.status.slice(1).toLowerCase();
        counts[label] = (counts[label] || 0) + 1;
      }
      setTripStatusCounts(counts);
    }
    if (licensesRes.success) setExpiringLicenses(licensesRes.data);
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    load();
  }, [load]);

  const handleLogout = async () => {
    // Await signOut so the server-side session cookie is cleared before
    // we navigate; next-auth's signOut() already redirects to /login via
    // its callbackUrl, so no manual window.location redirect is needed.
    await logout();
  };

  const vehicleStatusData = kpis
    ? [
        { name: "Available", value: kpis.availableVehicles, fill: VEHICLE_STATUS_COLORS.Available },
        { name: "On Trip", value: kpis.vehiclesOnTrip, fill: VEHICLE_STATUS_COLORS["On Trip"] },
        { name: "In Shop", value: kpis.vehiclesInShop, fill: VEHICLE_STATUS_COLORS["In Shop"] },
        {
          name: "Retired",
          value: Math.max(
            0,
            kpis.totalVehicles - kpis.availableVehicles - kpis.vehiclesOnTrip - kpis.vehiclesInShop
          ),
          fill: VEHICLE_STATUS_COLORS.Retired,
        },
      ].filter((d) => d.value > 0)
    : [];

  const tripStatusData = Object.entries(tripStatusCounts)
    .map(([name, value]) => ({ name, value, fill: TRIP_STATUS_COLORS[name] || "#6b7280" }))
    .filter((d) => d.value > 0);

  const costByVehicleData = roi.map((v: { registrationNumber: string; fuelCost: number; maintenanceCost: number }) => ({
    vehicle: v.registrationNumber,
    "Fuel Cost": v.fuelCost,
    "Maintenance Cost": v.maintenanceCost,
  }));

  const revenueByVehicleData = roi.map((v: { registrationNumber: string; revenue: number }) => ({
    vehicle: v.registrationNumber,
    Revenue: v.revenue,
  }));

  const licensesExpiringMessages = expiringLicenses
    .filter((d) => new Date(d.licenseExpiryDate) >= new Date())
    .slice(0, 5)
    .map((d) => `${d.name}'s license expires on ${formatDate(d.licenseExpiryDate)}`);

  const hasAlerts =
    licensesExpiringMessages.length > 0 ||
    (kpis && (kpis.licensesExpired > 0 || kpis.documentsExpiringSoon > 0 || kpis.documentsExpired > 0));

  return (
    <DashboardLayout onLogout={handleLogout} userName={user?.name || "User"} userRole={user?.role}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Welcome back, {user?.name}! Here's your fleet overview.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select
              value={filters.vehicleType || "all"}
              onValueChange={(value) => setFilters((f) => ({ ...f, vehicleType: value === "all" ? undefined : value }))}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Vehicle Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {filterOptions.vehicleTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.region || "all"}
              onValueChange={(value) => setFilters((f) => ({ ...f, region: value === "all" ? undefined : value }))}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {filterOptions.regions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Failed to load dashboard</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : isLoading || !kpis ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="Total Vehicles" value={kpis.totalVehicles} icon={Truck} description={`${kpis.activeVehicles} active`} />
              <KPICard title="Available Vehicles" value={kpis.availableVehicles} icon={Truck} description="Ready for dispatch" />
              <KPICard title="Active Trips" value={kpis.activeTrips} icon={Navigation} description={`${kpis.pendingTrips} pending`} />
              <KPICard title="Drivers On Duty" value={kpis.driversOnDuty} icon={Users} description={`of ${kpis.totalDrivers} total`} />
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KPICard title="Fleet Utilization" value={`${kpis.fleetUtilization}%`} icon={Zap} description="Vehicles on trip" />
              <KPICard title="Operational Cost" value={formatCurrency(kpis.totalOperationalCost)} icon={DollarSign} description="Fuel + maintenance + expenses" />
              <KPICard title="Fuel Efficiency" value={`${kpis.fuelEfficiency} km/L`} icon={Fuel} description="Completed trips average" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Vehicle Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {vehicleStatusData.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-16 text-center">No vehicle data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={vehicleStatusData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={80}
                          dataKey="value"
                        >
                          {vehicleStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Trip Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {tripStatusData.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-16 text-center">No trip data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={tripStatusData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={80}
                          dataKey="value"
                        >
                          {tripStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Fuel &amp; Maintenance Cost by Vehicle</CardTitle>
                </CardHeader>
                <CardContent>
                  {costByVehicleData.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-16 text-center">No vehicle cost data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={costByVehicleData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="vehicle" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Fuel Cost" fill="#10b981" />
                        <Bar dataKey="Maintenance Cost" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Revenue by Vehicle</CardTitle>
                </CardHeader>
                <CardContent>
                  {revenueByVehicleData.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-16 text-center">No revenue data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={revenueByVehicleData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="vehicle" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="Revenue" fill="#4F46E5" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Alerts */}
            {hasAlerts && (
              <Card className="border-amber-200/70 bg-amber-50/70 dark:bg-amber-900/20 dark:border-amber-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100 font-display">
                    <AlertCircle className="h-5 w-5" />
                    Alerts &amp; Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
                  {licensesExpiringMessages.map((msg, i) => (
                    <p key={i}>• {msg}</p>
                  ))}
                  {kpis.licensesExpired > 0 && <p>• {kpis.licensesExpired} driver license(s) have expired</p>}
                  {kpis.documentsExpiringSoon > 0 && <p>• {kpis.documentsExpiringSoon} vehicle document(s) expiring within 30 days</p>}
                  {kpis.documentsExpired > 0 && <p>• {kpis.documentsExpired} vehicle document(s) have expired</p>}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
