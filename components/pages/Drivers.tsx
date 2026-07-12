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
import { Plus, Download, Edit2, Trash2, AlertCircle, ArrowUpDown, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue, useServerTable } from "@/hooks/useServerTable";
import { createDriver, updateDriver, deleteDriver, getDrivers } from "@/actions/driver.actions";
import type { Driver, DriverStatus } from "@/types";
import { formatDate, exportToCSV } from "@/lib/helpers";
import { toast } from "sonner";

const DRIVER_STATUSES: DriverStatus[] = ["AVAILABLE", "ON_TRIP", "OFF_DUTY", "SUSPENDED"];
const LICENSE_CATEGORIES = ["A", "B", "C", "D", "E"];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "createdAt", label: "Date Added" },
  { value: "name", label: "Name" },
  { value: "licenseExpiryDate", label: "License Expiry" },
  { value: "safetyScore", label: "Safety Score" },
];

interface DriverFilters {
  status?: string;
  search?: string;
  sortBy: (typeof SORT_OPTIONS)[number]["value"];
  sortOrder: "asc" | "desc";
}

const emptyFormData = {
  name: "",
  licenseNumber: "",
  licenseCategory: "B",
  licenseExpiryDate: new Date().toISOString().split("T")[0],
  contactNumber: "",
  safetyScore: 80,
  status: "AVAILABLE" as DriverStatus,
};

const isLicenseExpired = (date: Date | string) => new Date(date) < new Date();

export default function Drivers() {
  const { user, logout } = useAuth();

  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 400);

  const { data: drivers, isLoading, error, filters, updateFilters, refetch } = useServerTable<
    Driver,
    DriverFilters
  >(getDrivers as any, {
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  useEffect(() => {
    updateFilters({ search: search || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState(emptyFormData);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const columns: ColumnDef<Driver>[] = useMemo(
    () => [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "licenseNumber", header: "License #" },
      { accessorKey: "licenseCategory", header: "Category" },
      {
        accessorKey: "licenseExpiryDate",
        header: "License Expiry",
        cell: ({ row }) => {
          const expired = isLicenseExpired(row.original.licenseExpiryDate);
          return (
            <span className={expired ? "text-red-600 font-semibold" : ""}>
              {formatDate(row.original.licenseExpiryDate)}
              {expired && " (EXPIRED)"}
            </span>
          );
        },
      },
      { accessorKey: "contactNumber", header: "Contact" },
      {
        accessorKey: "safetyScore",
        header: "Safety Score",
        cell: ({ row }) => (
          <span className={row.original.safetyScore >= 80 ? "text-green-600" : "text-yellow-600"}>
            {row.original.safetyScore}/100
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status.toLowerCase()} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => handleEdit(row.original)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={deletingId === row.original.id || row.original.status === "ON_TRIP"}
              onClick={() => handleDelete(row.original.id)}
              title={row.original.status === "ON_TRIP" ? "Cannot delete a driver on trip" : undefined}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deletingId]
  );

  const handleLogout = async () => {
    // Await signOut so the server-side session cookie is cleared before
    // we navigate; next-auth's signOut() already redirects to /login via
    // its callbackUrl, so no manual window.location redirect is needed.
    await logout();
  };

  const handleOpenDialog = () => {
    setEditingDriver(null);
    setFormData(emptyFormData);
    setFieldErrors({});
    setIsDialogOpen(true);
  };

  const handleEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setFormData({
      name: driver.name,
      licenseNumber: driver.licenseNumber,
      licenseCategory: driver.licenseCategory,
      licenseExpiryDate: new Date(driver.licenseExpiryDate).toISOString().split("T")[0],
      contactNumber: driver.contactNumber,
      safetyScore: driver.safetyScore,
      status: driver.status,
    });
    setFieldErrors({});
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this driver? This cannot be undone.")) return;
    setDeletingId(id);
    const res = await deleteDriver(id);
    setDeletingId(null);
    if (res.success) {
      toast.success("Driver deleted successfully");
      refetch();
    } else {
      toast.error(res.error || "Failed to delete driver");
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.licenseNumber || !formData.contactNumber) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});

    const payload = { ...formData, licenseExpiryDate: new Date(formData.licenseExpiryDate) };
    const res = editingDriver
      ? await updateDriver({ id: editingDriver.id, ...payload })
      : await createDriver(payload);

    setIsSubmitting(false);

    if (res.success) {
      toast.success(editingDriver ? "Driver updated successfully" : "Driver added successfully");
      setIsDialogOpen(false);
      refetch();
    } else {
      toast.error(res.error || "Failed to save driver");
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
    }
  };

  const handleExport = () => {
    const exportData = drivers.map((d) => ({
      Name: d.name,
      "License #": d.licenseNumber,
      Category: d.licenseCategory,
      "Expiry Date": formatDate(d.licenseExpiryDate),
      Contact: d.contactNumber,
      "Safety Score": d.safetyScore,
      Status: d.status,
    }));
    exportToCSV(exportData, "drivers");
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
            <h1 className="text-3xl font-bold text-foreground">Drivers</h1>
            <p className="text-muted-foreground mt-2">Manage your fleet drivers</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={drivers.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={handleOpenDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Driver
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
              placeholder="Search by name or license number..."
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
                  {DRIVER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Select value={filters.sortBy} onValueChange={(value) => updateFilters({ sortBy: value as DriverFilters["sortBy"] })}>
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
                <AlertTitle>Failed to load drivers</AlertTitle>
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
              <DataTable columns={columns} data={drivers} emptyMessage="No drivers found" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDriver ? "Edit Driver" : "Add New Driver"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., John Doe"
              />
              {fieldErrors.name && <p className="text-sm text-destructive">{fieldErrors.name[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="license">License Number *</Label>
              <Input
                id="license"
                value={formData.licenseNumber}
                onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                placeholder="e.g., DL-2024-001"
              />
              {fieldErrors.licenseNumber && <p className="text-sm text-destructive">{fieldErrors.licenseNumber[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">License Category</Label>
              <Select value={formData.licenseCategory} onValueChange={(value) => setFormData({ ...formData, licenseCategory: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LICENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry">License Expiry Date *</Label>
              <Input
                id="expiry"
                type="date"
                value={formData.licenseExpiryDate}
                onChange={(e) => setFormData({ ...formData, licenseExpiryDate: e.target.value })}
              />
              {fieldErrors.licenseExpiryDate && <p className="text-sm text-destructive">{fieldErrors.licenseExpiryDate[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Contact Number *</Label>
              <Input
                id="contact"
                value={formData.contactNumber}
                onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                placeholder="e.g., +1-555-0101"
              />
              {fieldErrors.contactNumber && <p className="text-sm text-destructive">{fieldErrors.contactNumber[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="safety">Safety Score (0-100)</Label>
              <Input
                id="safety"
                type="number"
                min="0"
                max="100"
                value={formData.safetyScore}
                onChange={(e) => setFormData({ ...formData, safetyScore: parseInt(e.target.value) || 0 })}
              />
              {fieldErrors.safetyScore && <p className="text-sm text-destructive">{fieldErrors.safetyScore[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as DriverStatus })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DRIVER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1" disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : editingDriver ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
