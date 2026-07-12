"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DataTable } from "@/components/DataTable";
import { SearchBar } from "@/components/SearchBar";
import { StatusBadge } from "@/components/StatusBadge";
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Download, FileText, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue, useServerTable } from "@/hooks/useServerTable";
import { createMaintenance, closeMaintenance, getMaintenanceLogs } from "@/actions/maintenance.actions";
import { getVehicles } from "@/actions/vehicle.actions";
import type { MaintenanceLog, Vehicle } from "@/types";
import { formatDate, formatCurrency, exportToCSV } from "@/lib/helpers";
import { toast } from "sonner";

type MaintenanceLogWithVehicle = MaintenanceLog & { vehicle: Vehicle };

const MAINTENANCE_STATUSES = ["ACTIVE", "COMPLETED"] as const;

const MAINTENANCE_TYPES = [
  { value: "Oil Change", label: "Oil Change" },
  { value: "Tire Rotation", label: "Tire Rotation" },
  { value: "Brake Service", label: "Brake Service" },
  { value: "Engine Repair", label: "Engine Repair" },
  { value: "General Inspection", label: "General Inspection" },
  { value: "Other", label: "Other" },
];

interface MaintenanceFilters {
  status?: string;
  vehicleId?: string;
}

const emptyFormData = {
  vehicleId: "",
  maintenanceType: "Oil Change",
  cost: 0,
  date: new Date().toISOString().split("T")[0],
  description: "",
};

export default function Maintenance() {
  const { user, logout } = useAuth();

  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 400);

  const { data: logs, isLoading, error, filters, updateFilters, refetch } = useServerTable<
    MaintenanceLogWithVehicle,
    MaintenanceFilters
  >(getMaintenanceLogs as any, {});

  // Client-side search over vehicle registration / description since the
  // server action doesn't accept a free-text search filter.
  const filteredLogs = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (l) =>
        l.vehicle?.registrationNumber?.toLowerCase().includes(q) ||
        l.description?.toLowerCase().includes(q)
    );
  }, [logs, search]);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  useEffect(() => {
    getVehicles({}).then((res) => {
      if (res.success) setVehicles(res.data);
    });
  }, []);

  // Vehicles eligible to be sent to maintenance: not already ON_TRIP or RETIRED.
  const eligibleVehicles = useMemo(
    () => vehicles.filter((v) => v.status === "AVAILABLE" || v.status === "IN_SHOP"),
    [vehicles]
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(emptyFormData);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [busyLogId, setBusyLogId] = useState<string | null>(null);

  const columns: ColumnDef<MaintenanceLogWithVehicle>[] = useMemo(
    () => [
      {
        id: "vehicle",
        header: "Vehicle",
        cell: ({ row }) => row.original.vehicle?.registrationNumber || "N/A",
      },
      { accessorKey: "maintenanceType", header: "Type" },
      {
        accessorKey: "cost",
        header: "Cost",
        cell: ({ row }) => formatCurrency(row.original.cost),
      },
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => formatDate(row.original.date),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status.toLowerCase()} />,
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => row.original.description || "-",
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const log = row.original;
          const busy = busyLogId === log.id;
          if (log.status !== "ACTIVE") return null;
          return (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => handleClose(log.id)}
              title="Close maintenance record"
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busyLogId]
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

  const handleClose = async (id: string) => {
    if (!window.confirm("Close this maintenance record? The vehicle will become available again."))
      return;
    setBusyLogId(id);
    const res = await closeMaintenance({ id });
    setBusyLogId(null);
    if (res.success) {
      toast.success("Maintenance record closed — vehicle is available again");
      refetch();
    } else {
      toast.error(res.error || "Failed to close maintenance record");
    }
  };

  const handleSubmit = async () => {
    if (!formData.vehicleId || !formData.cost || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});

    const res = await createMaintenance({
      vehicleId: formData.vehicleId,
      maintenanceType: formData.maintenanceType,
      description: formData.description,
      cost: formData.cost,
      date: new Date(formData.date),
    });

    setIsSubmitting(false);

    if (res.success) {
      toast.success("Vehicle sent to maintenance — status set to IN_SHOP");
      setIsDialogOpen(false);
      refetch();
    } else {
      toast.error(res.error || "Failed to create maintenance record");
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
    }
  };

  const handleExportCSV = () => {
    const exportData = filteredLogs.map((l) => ({
      Vehicle: l.vehicle?.registrationNumber || "N/A",
      Type: l.maintenanceType,
      Cost: formatCurrency(l.cost),
      Date: formatDate(l.date),
      Status: l.status,
      Description: l.description || "-",
    }));
    exportToCSV(exportData, "maintenance");
    toast.success("Exported to CSV");
  };

  const handleExportPDF = () => {
    window.open("/api/export/pdf?entity=maintenance", "_blank");
  };

  const resetFilters = () => {
    setRawSearch("");
    updateFilters({ status: undefined, vehicleId: undefined });
  };

  return (
    <DashboardLayout onLogout={handleLogout} userName={user?.name || "User"} userRole={user?.role}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Maintenance</h1>
            <p className="text-muted-foreground mt-2">Track vehicle maintenance records</p>
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
              Send to Maintenance
            </Button>
          </div>
        </div>

        {/* Search and Filter */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Search & Filter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SearchBar
              value={rawSearch}
              onChange={setRawSearch}
              placeholder="Search by vehicle or description..."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                value={filters.status || "all"}
                onValueChange={(value) => updateFilters({ status: value === "all" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {MAINTENANCE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
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
                <AlertTitle>Failed to load maintenance records</AlertTitle>
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
              <DataTable columns={columns} data={filteredLogs} emptyMessage="No maintenance records found" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Vehicle to Maintenance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehicle *</Label>
              <Select value={formData.vehicleId} onValueChange={(value) => setFormData({ ...formData, vehicleId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleVehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.registrationNumber} - {v.vehicleName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.vehicleId && <p className="text-sm text-destructive">{fieldErrors.vehicleId[0]}</p>}
              <p className="text-xs text-muted-foreground">Vehicles on trip or retired cannot be sent to maintenance.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Maintenance Type</Label>
              <Select value={formData.maintenanceType} onValueChange={(value) => setFormData({ ...formData, maintenanceType: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAINTENANCE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Cost *</Label>
              <Input
                id="cost"
                type="number"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                placeholder="e.g., 150"
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
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Regular oil change and filter replacement"
                rows={3}
              />
              {fieldErrors.description && <p className="text-sm text-destructive">{fieldErrors.description[0]}</p>}
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1" disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Send to Maintenance"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
