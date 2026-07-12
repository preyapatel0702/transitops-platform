"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DataTable } from "@/components/DataTable";
import { SearchBar } from "@/components/SearchBar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Download, FileText, AlertCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue, useServerTable } from "@/hooks/useServerTable";
import { createFuelLog, getFuelLogs } from "@/actions/fuel.actions";
import { getVehicles } from "@/actions/vehicle.actions";
import type { FuelLog, Vehicle } from "@/types";
import { formatDate, formatCurrency, formatFuel, exportToCSV } from "@/lib/helpers";
import { toast } from "sonner";

type FuelLogWithVehicle = FuelLog & { vehicle: Vehicle };

interface FuelFilters {
  vehicleId?: string;
}

const emptyFormData = {
  vehicleId: "",
  liters: 0,
  cost: 0,
  date: new Date().toISOString().split("T")[0],
};

export default function FuelLogs() {
  const { user, logout } = useAuth();

  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 400);

  const { data: logs, isLoading, error, filters, updateFilters, refetch } = useServerTable<
    FuelLogWithVehicle,
    FuelFilters
  >(getFuelLogs as any, {});

  const filteredLogs = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter((l) => l.vehicle?.registrationNumber?.toLowerCase().includes(q));
  }, [logs, search]);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  useEffect(() => {
    getVehicles({}).then((res) => {
      if (res.success) setVehicles(res.data);
    });
  }, []);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(emptyFormData);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const columns: ColumnDef<FuelLogWithVehicle>[] = useMemo(
    () => [
      {
        id: "vehicle",
        header: "Vehicle",
        cell: ({ row }) => row.original.vehicle?.registrationNumber || "N/A",
      },
      {
        accessorKey: "liters",
        header: "Liters",
        cell: ({ row }) => formatFuel(row.original.liters),
      },
      {
        accessorKey: "cost",
        header: "Cost",
        cell: ({ row }) => formatCurrency(row.original.cost),
      },
      {
        id: "costPerLiter",
        header: "Cost / Liter",
        cell: ({ row }) => formatCurrency(row.original.cost / row.original.liters),
      },
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => formatDate(row.original.date),
      },
    ],
    []
  );

  const handleLogout = async () => {
    // Await signOut so the server-side session cookie is cleared before
    // we navigate; next-auth's signOut() already redirects to /login via
    // its callbackUrl, so no manual window.location redirect is needed.
    await logout();
  };

  const handleOpenDialog = () => {
    setFormData(emptyFormData);
    setFieldErrors({});
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.vehicleId || !formData.liters || !formData.cost) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});

    const res = await createFuelLog({
      vehicleId: formData.vehicleId,
      liters: formData.liters,
      cost: formData.cost,
      date: new Date(formData.date),
    });

    setIsSubmitting(false);

    if (res.success) {
      toast.success("Fuel log created successfully");
      setIsDialogOpen(false);
      refetch();
    } else {
      toast.error(res.error || "Failed to create fuel log");
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
    }
  };

  const handleExportCSV = () => {
    const exportData = filteredLogs.map((l) => ({
      Vehicle: l.vehicle?.registrationNumber || "N/A",
      Liters: l.liters,
      Cost: formatCurrency(l.cost),
      Date: formatDate(l.date),
      "Cost per Liter": formatCurrency(l.cost / l.liters),
    }));
    exportToCSV(exportData, "fuel-logs");
    toast.success("Exported to CSV");
  };

  const handleExportPDF = () => {
    window.open("/api/export/pdf?entity=fuel", "_blank");
  };

  const resetFilters = () => {
    setRawSearch("");
    updateFilters({ vehicleId: undefined });
  };

  return (
    <DashboardLayout onLogout={handleLogout} userName={user?.name || "User"} userRole={user?.role}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Fuel Logs</h1>
            <p className="text-muted-foreground mt-2">Track fuel consumption and costs</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV} disabled={filteredLogs.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" onClick={handleExportPDF}>
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button onClick={handleOpenDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New Entry
            </Button>
          </div>
        </div>

        {/* Search and Filter */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Search & Filter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SearchBar value={rawSearch} onChange={setRawSearch} placeholder="Search by vehicle..." />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                value={filters.vehicleId || "all"}
                onValueChange={(value) => updateFilters({ vehicleId: value === "all" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by vehicle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vehicles</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.registrationNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div />
              <Button variant="outline" onClick={resetFilters}>
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="pt-6">
            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Failed to load fuel logs</AlertTitle>
                <AlertDescription className="flex items-center justify-between gap-4">
                  <span>{error}</span>
                  <Button variant="outline" size="sm" onClick={refetch}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <DataTable columns={columns} data={filteredLogs} emptyMessage="No fuel logs found" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Fuel Log</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehicle *</Label>
              <Select value={formData.vehicleId} onValueChange={(value) => setFormData({ ...formData, vehicleId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.registrationNumber} - {v.vehicleName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.vehicleId && <p className="text-sm text-destructive">{fieldErrors.vehicleId[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="liters">Liters *</Label>
              <Input
                id="liters"
                type="number"
                step="0.1"
                value={formData.liters}
                onChange={(e) => setFormData({ ...formData, liters: parseFloat(e.target.value) || 0 })}
                placeholder="e.g., 35.5"
              />
              {fieldErrors.liters && <p className="text-sm text-destructive">{fieldErrors.liters[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Cost *</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                placeholder="e.g., 105.50"
              />
              {fieldErrors.cost && <p className="text-sm text-destructive">{fieldErrors.cost[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1" disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
