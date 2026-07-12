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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Download, Edit2, AlertCircle, ArrowUpDown, RefreshCw, Send, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue, useServerTable } from "@/hooks/useServerTable";
import { createTrip, updateTrip, dispatchTrip, completeTrip, cancelTrip, getTrips } from "@/actions/trip.actions";
import { getDispatchableVehicles } from "@/actions/vehicle.actions";
import { getDispatchableDrivers } from "@/actions/driver.actions";
import type { TripWithRelations, Vehicle, Driver, TripStatus } from "@/types";
import { formatDate, formatCurrency, exportToCSV } from "@/lib/helpers";
import { toast } from "sonner";

const TRIP_STATUSES: TripStatus[] = ["DRAFT", "DISPATCHED", "COMPLETED", "CANCELLED"];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "createdAt", label: "Date Created" },
  { value: "plannedDistance", label: "Planned Distance" },
  { value: "cargoWeight", label: "Cargo Weight" },
  { value: "revenue", label: "Revenue" },
];

interface TripFilters {
  status?: string;
  search?: string;
  sortBy: (typeof SORT_OPTIONS)[number]["value"];
  sortOrder: "asc" | "desc";
}

const emptyFormData = {
  source: "",
  destination: "",
  vehicleId: "",
  driverId: "",
  cargoWeight: 0,
  plannedDistance: 0,
  revenue: 0,
};

const emptyCompleteData = {
  finalOdometer: 0,
  fuelUsed: 0,
  fuelCost: 0,
  actualDistance: 0,
};

export default function Trips() {
  const { user, logout } = useAuth();

  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 400);

  const { data: trips, isLoading, error, filters, updateFilters, refetch } = useServerTable<
    TripWithRelations,
    TripFilters
  >(getTrips as any, {
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  useEffect(() => {
    updateFilters({ search: search || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Vehicles/drivers eligible for a new trip (fetched when the create dialog opens)
  const [dispatchableVehicles, setDispatchableVehicles] = useState<Vehicle[]>([]);
  const [dispatchableDrivers, setDispatchableDrivers] = useState<Driver[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTrip, setEditingTrip] = useState<TripWithRelations | null>(null);
  const [formData, setFormData] = useState(emptyFormData);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [completingTrip, setCompletingTrip] = useState<TripWithRelations | null>(null);
  const [completeData, setCompleteData] = useState(emptyCompleteData);
  const [completeErrors, setCompleteErrors] = useState<Record<string, string[]>>({});
  const [isCompleting, setIsCompleting] = useState(false);

  const [busyTripId, setBusyTripId] = useState<string | null>(null);

  const loadDispatchOptions = async () => {
    setIsLoadingOptions(true);
    const [vRes, dRes] = await Promise.all([getDispatchableVehicles(), getDispatchableDrivers()]);
    if (vRes.success) setDispatchableVehicles(vRes.data);
    if (dRes.success) setDispatchableDrivers(dRes.data);
    setIsLoadingOptions(false);
  };

  const columns: ColumnDef<TripWithRelations>[] = useMemo(
    () => [
      { accessorKey: "source", header: "Source" },
      { accessorKey: "destination", header: "Destination" },
      {
        id: "vehicle",
        header: "Vehicle",
        cell: ({ row }) => row.original.vehicle?.registrationNumber || "N/A",
      },
      {
        id: "driver",
        header: "Driver",
        cell: ({ row }) => row.original.driver?.name || "N/A",
      },
      {
        accessorKey: "cargoWeight",
        header: "Cargo (kg)",
        cell: ({ row }) => row.original.cargoWeight.toLocaleString(),
      },
      {
        accessorKey: "plannedDistance",
        header: "Planned Dist. (km)",
        cell: ({ row }) => row.original.plannedDistance.toLocaleString(),
      },
      {
        accessorKey: "revenue",
        header: "Revenue",
        cell: ({ row }) => (row.original.revenue != null ? formatCurrency(row.original.revenue) : "-"),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status.toLowerCase()} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const trip = row.original;
          const busy = busyTripId === trip.id;
          return (
            <div className="flex gap-1">
              {trip.status === "DRAFT" && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(trip)} title="Edit">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => handleDispatch(trip.id)} title="Dispatch">
                    <Send className="h-4 w-4" />
                  </Button>
                </>
              )}
              {trip.status === "DISPATCHED" && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => handleOpenComplete(trip)} title="Complete">
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              )}
              {(trip.status === "DRAFT" || trip.status === "DISPATCHED") && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => handleCancel(trip.id)} title="Cancel">
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busyTripId]
  );

  const handleLogout = async () => {
    // Await signOut so the server-side session cookie is cleared before
    // we navigate; next-auth's signOut() already redirects to /login via
    // its callbackUrl, so no manual window.location redirect is needed.
    await logout();
  };

  const handleOpenDialog = () => {
    setEditingTrip(null);
    setFormData(emptyFormData);
    setFieldErrors({});
    setIsDialogOpen(true);
    loadDispatchOptions();
  };

  const handleEdit = (trip: TripWithRelations) => {
    setEditingTrip(trip);
    setFormData({
      source: trip.source,
      destination: trip.destination,
      vehicleId: trip.vehicleId,
      driverId: trip.driverId,
      cargoWeight: trip.cargoWeight,
      plannedDistance: trip.plannedDistance,
      revenue: trip.revenue || 0,
    });
    setFieldErrors({});
    setIsDialogOpen(true);
  };

  const handleDispatch = async (id: string) => {
    if (!window.confirm("Dispatch this trip? The vehicle and driver will be marked on-trip.")) return;
    setBusyTripId(id);
    const res = await dispatchTrip(id);
    setBusyTripId(null);
    if (res.success) {
      toast.success("Trip dispatched");
      refetch();
    } else {
      toast.error(res.error || "Failed to dispatch trip");
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm("Cancel this trip?")) return;
    setBusyTripId(id);
    const res = await cancelTrip({ id });
    setBusyTripId(null);
    if (res.success) {
      toast.success("Trip cancelled");
      refetch();
    } else {
      toast.error(res.error || "Failed to cancel trip");
    }
  };

  const handleOpenComplete = (trip: TripWithRelations) => {
    setCompletingTrip(trip);
    setCompleteData({
      finalOdometer: trip.vehicle?.odometer || 0,
      fuelUsed: 0,
      fuelCost: 0,
      actualDistance: trip.plannedDistance,
    });
    setCompleteErrors({});
  };

  const handleSubmitComplete = async () => {
    if (!completingTrip) return;
    setIsCompleting(true);
    setCompleteErrors({});
    const res = await completeTrip({ id: completingTrip.id, ...completeData });
    setIsCompleting(false);
    if (res.success) {
      toast.success("Trip completed");
      setCompletingTrip(null);
      refetch();
    } else {
      toast.error(res.error || "Failed to complete trip");
      if (res.fieldErrors) setCompleteErrors(res.fieldErrors);
    }
  };

  const handleSubmit = async () => {
    if (!formData.source || !formData.destination || (!editingTrip && (!formData.vehicleId || !formData.driverId))) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});

    const res = editingTrip
      ? await updateTrip({
          id: editingTrip.id,
          source: formData.source,
          destination: formData.destination,
          cargoWeight: formData.cargoWeight,
          plannedDistance: formData.plannedDistance,
          revenue: formData.revenue || undefined,
        })
      : await createTrip({
          source: formData.source,
          destination: formData.destination,
          vehicleId: formData.vehicleId,
          driverId: formData.driverId,
          cargoWeight: formData.cargoWeight,
          plannedDistance: formData.plannedDistance,
          revenue: formData.revenue || undefined,
        });

    setIsSubmitting(false);

    if (res.success) {
      toast.success(editingTrip ? "Trip updated successfully" : "Trip created successfully");
      setIsDialogOpen(false);
      refetch();
    } else {
      toast.error(res.error || "Failed to save trip");
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
    }
  };

  const handleExport = () => {
    const exportData = trips.map((t) => ({
      Source: t.source,
      Destination: t.destination,
      Vehicle: t.vehicle?.registrationNumber || "N/A",
      Driver: t.driver?.name || "N/A",
      "Cargo Weight (kg)": t.cargoWeight,
      "Planned Distance (km)": t.plannedDistance,
      "Actual Distance (km)": t.actualDistance || "-",
      "Fuel Used (L)": t.fuelUsed || "-",
      Revenue: t.revenue ?? "-",
      Status: t.status,
    }));
    exportToCSV(exportData, "trips");
    toast.success("Exported to CSV");
  };

  const toggleSortOrder = () =>
    updateFilters({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" });

  const resetFilters = () => {
    setRawSearch("");
    updateFilters({ status: undefined, search: undefined, sortBy: "createdAt", sortOrder: "desc" });
  };

  return (
    <DashboardLayout onLogout={handleLogout} userName={user?.name || "User"} userRole={user?.role}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Trips</h1>
            <p className="text-muted-foreground mt-2">Manage and track your trips</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={trips.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={handleOpenDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New Trip
            </Button>
          </div>
        </div>

        {/* Search and Filter */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Search, Filter & Sort</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SearchBar
              value={rawSearch}
              onChange={setRawSearch}
              placeholder="Search by source or destination..."
            />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select
                value={filters.status || "all"}
                onValueChange={(value) => updateFilters({ status: value === "all" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {TRIP_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Select value={filters.sortBy} onValueChange={(value) => updateFilters({ sortBy: value as TripFilters["sortBy"] })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={toggleSortOrder} title={`Sort ${filters.sortOrder === "asc" ? "descending" : "ascending"}`}>
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>
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
                <AlertTitle>Failed to load trips</AlertTitle>
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
              <DataTable columns={columns} data={trips} emptyMessage="No trips found" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTrip ? "Edit Trip" : "Create New Trip"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="source">Source *</Label>
              <Input
                id="source"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                placeholder="e.g., Warehouse A"
              />
              {fieldErrors.source && <p className="text-sm text-destructive">{fieldErrors.source[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">Destination *</Label>
              <Input
                id="destination"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                placeholder="e.g., Distribution Center B"
              />
              {fieldErrors.destination && <p className="text-sm text-destructive">{fieldErrors.destination[0]}</p>}
            </div>
            {!editingTrip && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="vehicle">Vehicle *</Label>
                  <Select value={formData.vehicleId} onValueChange={(value) => setFormData({ ...formData, vehicleId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingOptions ? "Loading..." : "Select vehicle"} />
                    </SelectTrigger>
                    <SelectContent>
                      {dispatchableVehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.registrationNumber} - {v.vehicleName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.vehicleId && <p className="text-sm text-destructive">{fieldErrors.vehicleId[0]}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver">Driver *</Label>
                  <Select value={formData.driverId} onValueChange={(value) => setFormData({ ...formData, driverId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingOptions ? "Loading..." : "Select driver"} />
                    </SelectTrigger>
                    <SelectContent>
                      {dispatchableDrivers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.driverId && <p className="text-sm text-destructive">{fieldErrors.driverId[0]}</p>}
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="weight">Cargo Weight (kg) *</Label>
              <Input
                id="weight"
                type="number"
                value={formData.cargoWeight}
                onChange={(e) => setFormData({ ...formData, cargoWeight: parseFloat(e.target.value) || 0 })}
                placeholder="e.g., 450"
              />
              {fieldErrors.cargoWeight && <p className="text-sm text-destructive">{fieldErrors.cargoWeight[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="distance">Planned Distance (km) *</Label>
              <Input
                id="distance"
                type="number"
                value={formData.plannedDistance}
                onChange={(e) => setFormData({ ...formData, plannedDistance: parseFloat(e.target.value) || 0 })}
                placeholder="e.g., 150"
              />
              {fieldErrors.plannedDistance && <p className="text-sm text-destructive">{fieldErrors.plannedDistance[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="revenue">Revenue (optional)</Label>
              <Input
                id="revenue"
                type="number"
                value={formData.revenue}
                onChange={(e) => setFormData({ ...formData, revenue: parseFloat(e.target.value) || 0 })}
                placeholder="e.g., 800"
              />
              {fieldErrors.revenue && <p className="text-sm text-destructive">{fieldErrors.revenue[0]}</p>}
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1" disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : editingTrip ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete Trip Dialog */}
      <Dialog open={!!completingTrip} onOpenChange={(open) => !open && setCompletingTrip(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Trip</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="finalOdometer">Final Odometer (km) *</Label>
              <Input
                id="finalOdometer"
                type="number"
                value={completeData.finalOdometer}
                onChange={(e) => setCompleteData({ ...completeData, finalOdometer: parseFloat(e.target.value) || 0 })}
              />
              {completeErrors.finalOdometer && <p className="text-sm text-destructive">{completeErrors.finalOdometer[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="actualDistance">Actual Distance (km) *</Label>
              <Input
                id="actualDistance"
                type="number"
                value={completeData.actualDistance}
                onChange={(e) => setCompleteData({ ...completeData, actualDistance: parseFloat(e.target.value) || 0 })}
              />
              {completeErrors.actualDistance && <p className="text-sm text-destructive">{completeErrors.actualDistance[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fuelUsed">Fuel Used (L) *</Label>
              <Input
                id="fuelUsed"
                type="number"
                step="0.1"
                value={completeData.fuelUsed}
                onChange={(e) => setCompleteData({ ...completeData, fuelUsed: parseFloat(e.target.value) || 0 })}
              />
              {completeErrors.fuelUsed && <p className="text-sm text-destructive">{completeErrors.fuelUsed[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fuelCost">Fuel Cost *</Label>
              <Input
                id="fuelCost"
                type="number"
                value={completeData.fuelCost}
                onChange={(e) => setCompleteData({ ...completeData, fuelCost: parseFloat(e.target.value) || 0 })}
              />
              {completeErrors.fuelCost && <p className="text-sm text-destructive">{completeErrors.fuelCost[0]}</p>}
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setCompletingTrip(null)} className="flex-1" disabled={isCompleting}>
                Cancel
              </Button>
              <Button onClick={handleSubmitComplete} className="flex-1" disabled={isCompleting}>
                {isCompleting ? "Saving..." : "Complete Trip"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
