"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { Download, FileText, AlertCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getAnalyticsReport, getFuelReport, getMaintenanceReport, getExpenseReport, getTripsReport } from "@/actions/report.actions";
import type { DashboardKPIs } from "@/services/dashboard.service";
import { formatCurrency, exportToCSV } from "@/lib/helpers";
import { toast } from "sonner";

interface RoiRow {
  vehicleId: string;
  registrationNumber: string;
  vehicleName: string;
  revenue: number;
  fuelCost: number;
  maintenanceCost: number;
  roi: number;
}

const COST_COLORS = { fuel: "#3b82f6", maintenance: "#f59e0b", other: "#8b5cf6" };

export default function Reports() {
  const { user, logout } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [roiBreakdown, setRoiBreakdown] = useState<RoiRow[]>([]);
  const [fuelTotalCost, setFuelTotalCost] = useState(0);
  const [maintenanceTotalCost, setMaintenanceTotalCost] = useState(0);
  const [expenseByType, setExpenseByType] = useState<{ expenseType: string; _sum: { amount: number | null } }[]>([]);
  const [monthlyTrendData, setMonthlyTrendData] = useState<
    { month: string; cost: number; trips: number; distance: number }[]
  >([]);

  const handleLogout = async () => {
    // Await signOut so the server-side session cookie is cleared before
    // we navigate; next-auth's signOut() already redirects to /login via
    // its callbackUrl, so no manual window.location redirect is needed.
    await logout();
  };

  const loadAll = async () => {
    setIsLoading(true);
    setError(null);
    const [analyticsRes, fuelRes, maintenanceRes, expenseRes, tripsRes] = await Promise.all([
      getAnalyticsReport(),
      getFuelReport(),
      getMaintenanceReport(),
      getExpenseReport(),
      getTripsReport(),
    ]);

    if (!analyticsRes.success) {
      setError(analyticsRes.error || "Failed to load analytics");
      setIsLoading(false);
      return;
    }

    setKpis(analyticsRes.data.kpis);
    setRoiBreakdown(analyticsRes.data.roiBreakdown as RoiRow[]);
    if (fuelRes.success) setFuelTotalCost(fuelRes.data.totalCost);
    if (maintenanceRes.success) setMaintenanceTotalCost(maintenanceRes.data.totalCost);
    if (expenseRes.success) setExpenseByType(expenseRes.data.byType as any);

    // Build a monthly trend from real trip data (cost proxy = revenue, since
    // per-trip fuel/maintenance cost isn't tracked; trip count & distance are exact).
    if (tripsRes.success) {
      const buckets = new Map<string, { cost: number; trips: number; distance: number; order: number }>();
      tripsRes.data.forEach((t: any) => {
        const d = new Date(t.createdAt);
        const key = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        const order = d.getFullYear() * 12 + d.getMonth();
        const existing = buckets.get(key) || { cost: 0, trips: 0, distance: 0, order };
        existing.cost += t.revenue || 0;
        existing.trips += 1;
        existing.distance += t.actualDistance || t.plannedDistance || 0;
        buckets.set(key, existing);
      });
      const trend = Array.from(buckets.entries())
        .map(([month, v]) => ({ month, ...v }))
        .sort((a, b) => a.order - b.order)
        .slice(-6);
      setMonthlyTrendData(trend);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalExpenses = useMemo(
    () => expenseByType.reduce((sum, e) => sum + (e._sum.amount || 0), 0),
    [expenseByType]
  );

  const totalOperationalCost = fuelTotalCost + maintenanceTotalCost + totalExpenses;

  const vehicleCostData = useMemo(
    () =>
      roiBreakdown.map((v) => ({
        vehicle: v.registrationNumber,
        fuel: v.fuelCost,
        maintenance: v.maintenanceCost,
      })),
    [roiBreakdown]
  );

  const vehicleRevenueData = useMemo(
    () => roiBreakdown.map((v) => ({ vehicle: v.registrationNumber, revenue: v.revenue, roi: v.roi })),
    [roiBreakdown]
  );

  const handleExportCSV = (name: string, data: Record<string, unknown>[]) => {
    exportToCSV(data, `report-${name}`);
    toast.success(`${name} exported to CSV`);
  };

  const handleExportPDF = (entity: string) => {
    window.open(`/api/export/pdf?entity=${entity}`, "_blank");
  };

  return (
    <DashboardLayout onLogout={handleLogout} userName={user?.name || "User"} userRole={user?.role}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
            <p className="text-muted-foreground mt-2">
              Comprehensive fleet performance and financial analytics
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExportPDF("dashboard")}>
              <FileText className="h-4 w-4 mr-2" />
              Full PDF Report
            </Button>
            <Button variant="outline" size="icon" onClick={loadAll} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Failed to load reports</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={loadAll}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : isLoading || !kpis ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Operational Cost
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalOperationalCost)}</div>
                  <p className="text-xs text-muted-foreground mt-2">Fuel + Maintenance + Other</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Fleet Fuel Efficiency
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpis.fuelEfficiency.toFixed(2)} km/L</div>
                  <p className="text-xs text-muted-foreground mt-2">Average across completed trips</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Fleet Utilization
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpis.fleetUtilization.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {kpis.vehiclesOnTrip} of {kpis.totalVehicles} vehicles on trip
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Fleet ROI</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(kpis.fleetROI * 100).toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Revenue {formatCurrency(kpis.totalRevenue)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue & ROI by Vehicle */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Revenue by Vehicle</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleExportCSV("vehicle-revenue", vehicleRevenueData)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleExportPDF("vehicles")}>
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={vehicleRevenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="vehicle" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Cost Breakdown by Vehicle */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Cost Breakdown by Vehicle</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleExportCSV("vehicle-costs", vehicleCostData)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleExportPDF("vehicles")}>
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={vehicleCostData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="vehicle" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <Legend />
                      <Bar dataKey="fuel" fill={COST_COLORS.fuel} name="Fuel" />
                      <Bar dataKey="maintenance" fill={COST_COLORS.maintenance} name="Maintenance" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Monthly Trend */}
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Monthly Trip Trend</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleExportCSV("monthly-trend", monthlyTrendData)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleExportPDF("trips")}>
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {monthlyTrendData.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">
                      Not enough trip history to chart a monthly trend yet.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={monthlyTrendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="cost" stroke="#3b82f6" name="Revenue ($)" />
                        <Line type="monotone" dataKey="trips" stroke="#10b981" name="Trips" />
                        <Line type="monotone" dataKey="distance" stroke="#f59e0b" name="Distance (km)" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Cost Distribution */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Cost Distribution</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleExportCSV("cost-distribution", [
                          { Fuel: fuelTotalCost, Maintenance: maintenanceTotalCost, Other: totalExpenses },
                        ])
                      }
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Fuel", value: fuelTotalCost, fill: COST_COLORS.fuel },
                          { name: "Maintenance", value: maintenanceTotalCost, fill: COST_COLORS.maintenance },
                          { name: "Other", value: totalExpenses, fill: COST_COLORS.other },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${formatCurrency(value as number)}`}
                        outerRadius={80}
                        dataKey="value"
                      >
                        {[COST_COLORS.fuel, COST_COLORS.maintenance, COST_COLORS.other].map((fill, index) => (
                          <Cell key={`cell-${index}`} fill={fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Summary Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Cost Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Fuel Cost</span>
                      <span className="font-semibold">{formatCurrency(fuelTotalCost)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Maintenance Cost</span>
                      <span className="font-semibold">{formatCurrency(maintenanceTotalCost)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Other Expenses</span>
                      <span className="font-semibold">{formatCurrency(totalExpenses)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="font-semibold">Total Cost</span>
                      <span className="font-bold text-lg">{formatCurrency(totalOperationalCost)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Export shortcuts for underlying entities */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Export Raw Data</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {["vehicles", "drivers", "trips", "maintenance", "fuel", "expenses"].map((entity) => (
                  <div key={entity} className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => window.open(`/api/export/csv?entity=${entity}`, "_blank")}>
                      <Download className="h-4 w-4 mr-1" />
                      {entity} CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExportPDF(entity)}>
                      <FileText className="h-4 w-4 mr-1" />
                      {entity} PDF
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
