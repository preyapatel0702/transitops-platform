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
import { Plus, Download, Edit2, Trash2, FileText, AlertCircle, ArrowUpDown, RefreshCw, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue, useServerTable } from "@/hooks/useServerTable";
import {
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getVehicles,
  getVehicleFilterOptions,
} from "@/actions/vehicle.actions";
import {
  createVehicleDocument,
  deleteVehicleDocument,
  getVehicleDocuments,
} from "@/actions/document.actions";
import type { Vehicle, VehicleStatus, VehicleDocument, DocumentType } from "@/types";
import { formatCurrency, formatDate, exportToCSV } from "@/lib/helpers";
import { toast } from "sonner";

const DOCUMENT_TYPES: DocumentType[] = [
  "REGISTRATION_CERTIFICATE",
  "INSURANCE",
  "PERMIT",
  "POLLUTION_CERTIFICATE",
  "FITNESS",
  "OTHER",
];

const VEHICLE_STATUSES: VehicleStatus[] = ["AVAILABLE", "ON_TRIP", "IN_SHOP", "RETIRED"];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "createdAt", label: "Date Added" },
  { value: "registrationNumber", label: "Registration #" },
  { value: "vehicleName", label: "Name" },
  { value: "odometer", label: "Odometer" },
  { value: "acquisitionCost", label: "Acquisition Cost" },
  { value: "maxLoadCapacity", label: "Max Load Capacity" },
];

interface VehicleFilters {
  status?: string;
  search?: string;
  vehicleType?: string;
  region?: string;
  sortBy: (typeof SORT_OPTIONS)[number]["value"];
  sortOrder: "asc" | "desc";
}

const emptyFormData = {
  registrationNumber: "",
  vehicleName: "",
  model: "",
  vehicleType: "",
  region: "",
  maxLoadCapacity: 0,
  odometer: 0,
  acquisitionCost: 0,
  status: "AVAILABLE" as VehicleStatus,
};

export default function Vehicles() {
  const { user, logout } = useAuth();

  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 400);

  const { data: vehicles, isLoading, error, filters, updateFilters, refetch } = useServerTable<
    Vehicle,
    VehicleFilters
  >(getVehicles as any, {
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  useEffect(() => {
    updateFilters({ search: search || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const [filterOptions, setFilterOptions] = useState<{ vehicleTypes: string[]; regions: string[] }>({
    vehicleTypes: [],
    regions: [],
  });

  useEffect(() => {
    getVehicleFilterOptions().then((res) => {
      if (res.success) setFilterOptions(res.data);
    });
  }, []);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState(emptyFormData);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Vehicle documents dialog
  const [docsVehicle, setDocsVehicle] = useState<Vehicle | null>(null);
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [docFormData, setDocFormData] = useState({
    docType: "REGISTRATION_CERTIFICATE" as DocumentType,
    documentNumber: "",
    documentUrl: "",
    expiryDate: "",
  });
  const [docFieldErrors, setDocFieldErrors] = useState<Record<string, string[]>>({});
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const columns: ColumnDef<Vehicle>[] = useMemo(
    () => [
      { accessorKey: "registrationNumber", header: "Registration" },
      { accessorKey: "vehicleName", header: "Name" },
      { accessorKey: "model", header: "Model" },
      { accessorKey: "vehicleType", header: "Type" },
      { accessorKey: "region", header: "Region" },
      {
        accessorKey: "maxLoadCapacity",
        header: "Capacity (kg)",
        cell: ({ row }) => row.original.maxLoadCapacity.toLocaleString(),
      },
      {
        accessorKey: "odometer",
        header: "Odometer (km)",
        cell: ({ row }) => row.original.odometer.toLocaleString(),
      },
      {
        accessorKey: "acquisitionCost",
        header: "Cost",
        cell: ({ row }) => formatCurrency(row.original.acquisitionCost),
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
            <Button variant="ghost" size="sm" onClick={() => handleOpenDocuments(row.original)} title="Documents">
              <FileText className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleEdit(row.original)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={deletingId === row.original.id || row.original.status === "ON_TRIP"}
              onClick={() => handleDelete(row.original.id)}
              title={row.original.status === "ON_TRIP" ? "Cannot delete a vehicle on trip" : undefined}
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
    setEditingVehicle(null);
    setFormData(emptyFormData);
    setFieldErrors({});
    setIsDialogOpen(true);
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      registrationNumber: vehicle.registrationNumber,
      vehicleName: vehicle.vehicleName,
      model: vehicle.model,
      vehicleType: vehicle.vehicleType,
      region: vehicle.region,
      maxLoadCapacity: vehicle.maxLoadCapacity,
      odometer: vehicle.odometer,
      acquisitionCost: vehicle.acquisitionCost,
      status: vehicle.status,
    });
    setFieldErrors({});
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this vehicle? This cannot be undone.")) return;
    setDeletingId(id);
    const res = await deleteVehicle(id);
    setDeletingId(null);
    if (res.success) {
      toast.success("Vehicle deleted successfully");
      refetch();
    } else {
      toast.error(res.error || "Failed to delete vehicle");
    }
  };

  const handleOpenDocuments = async (vehicle: Vehicle) => {
    setDocsVehicle(vehicle);
    setDocFormData({ docType: "REGISTRATION_CERTIFICATE", documentNumber: "", documentUrl: "", expiryDate: "" });
    setDocFieldErrors({});
    setIsLoadingDocs(true);
    const res = await getVehicleDocuments(vehicle.id);
    setIsLoadingDocs(false);
    if (res.success) setDocuments(res.data);
    else toast.error(res.error || "Failed to load documents");
  };

  const handleAddDocument = async () => {
    if (!docsVehicle || !docFormData.documentUrl) {
      toast.error("Please provide a document URL");
      return;
    }
    setIsAddingDoc(true);
    setDocFieldErrors({});
    const res = await createVehicleDocument({
      vehicleId: docsVehicle.id,
      docType: docFormData.docType,
      documentNumber: docFormData.documentNumber || undefined,
      documentUrl: docFormData.documentUrl,
      expiryDate: docFormData.expiryDate ? new Date(docFormData.expiryDate) : undefined,
    });
    setIsAddingDoc(false);
    if (res.success) {
      toast.success("Document added successfully");
      setDocFormData({ docType: "REGISTRATION_CERTIFICATE", documentNumber: "", documentUrl: "", expiryDate: "" });
      handleOpenDocuments(docsVehicle);
    } else {
      toast.error(res.error || "Failed to add document");
      if (res.fieldErrors) setDocFieldErrors(res.fieldErrors);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!window.confirm("Delete this document?")) return;
    setDeletingDocId(id);
    const res = await deleteVehicleDocument(id);
    setDeletingDocId(null);
    if (res.success) {
      toast.success("Document deleted successfully");
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } else {
      toast.error(res.error || "Failed to delete document");
    }
  };

  const handleSubmit = async () => {
    if (!formData.registrationNumber || !formData.vehicleName || !formData.model || !formData.vehicleType || !formData.region) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});

    const res = editingVehicle
      ? await updateVehicle({ id: editingVehicle.id, ...formData })
      : await createVehicle(formData);

    setIsSubmitting(false);

    if (res.success) {
      toast.success(editingVehicle ? "Vehicle updated successfully" : "Vehicle added successfully");
      setIsDialogOpen(false);
      refetch();
    } else {
      toast.error(res.error || "Failed to save vehicle");
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
    }
  };

  const handleExport = () => {
    const exportData = vehicles.map((v) => ({
      "Registration #": v.registrationNumber,
      Name: v.vehicleName,
      Model: v.model,
      Type: v.vehicleType,
      Region: v.region,
      "Capacity (kg)": v.maxLoadCapacity,
      "Odometer (km)": v.odometer,
      "Acquisition Cost": formatCurrency(v.acquisitionCost),
      Status: v.status,
    }));
    exportToCSV(exportData, "vehicles");
    toast.success("Exported to CSV");
  };

  const toggleSortOrder = () =>
    updateFilters({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" });

  const resetFilters = () => {
    setRawSearch("");
    updateFilters({ status: undefined, vehicleType: undefined, region: undefined, search: undefined, sortBy: "createdAt", sortOrder: "desc" });
  };

  return (
    <DashboardLayout onLogout={handleLogout} userName={user?.name || "User"} userRole={user?.role}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Vehicles</h1>
            <p className="text-muted-foreground mt-2">Manage your fleet vehicles</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={vehicles.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={handleOpenDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Vehicle
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
              placeholder="Search by registration or name..."
            />
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Select
                value={filters.status || "all"}
                onValueChange={(value) => updateFilters({ status: value === "all" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {VEHICLE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.vehicleType || "all"}
                onValueChange={(value) => updateFilters({ vehicleType: value === "all" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by type" />
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
                onValueChange={(value) => updateFilters({ region: value === "all" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by region" />
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
              <div className="flex gap-2">
                <Select value={filters.sortBy} onValueChange={(value) => updateFilters({ sortBy: value as VehicleFilters["sortBy"] })}>
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
                <AlertTitle>Failed to load vehicles</AlertTitle>
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
              <DataTable columns={columns} data={vehicles} emptyMessage="No vehicles found" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reg">Registration Number *</Label>
              <Input
                id="reg"
                value={formData.registrationNumber}
                onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                placeholder="e.g., VAN-001"
              />
              {fieldErrors.registrationNumber && (
                <p className="text-sm text-destructive">{fieldErrors.registrationNumber[0]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Vehicle Name *</Label>
              <Input
                id="name"
                value={formData.vehicleName}
                onChange={(e) => setFormData({ ...formData, vehicleName: e.target.value })}
                placeholder="e.g., Van Alpha"
              />
              {fieldErrors.vehicleName && <p className="text-sm text-destructive">{fieldErrors.vehicleName[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model *</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="e.g., Ford Transit"
              />
              {fieldErrors.model && <p className="text-sm text-destructive">{fieldErrors.model[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Vehicle Type *</Label>
              <Input
                id="type"
                value={formData.vehicleType}
                onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                placeholder="e.g., van, truck, bus"
              />
              {fieldErrors.vehicleType && <p className="text-sm text-destructive">{fieldErrors.vehicleType[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Region *</Label>
              <Input
                id="region"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder="e.g., North, West"
              />
              {fieldErrors.region && <p className="text-sm text-destructive">{fieldErrors.region[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Max Load Capacity (kg) *</Label>
              <Input
                id="capacity"
                type="number"
                value={formData.maxLoadCapacity}
                onChange={(e) => setFormData({ ...formData, maxLoadCapacity: parseFloat(e.target.value) || 0 })}
                placeholder="e.g., 500"
              />
              {fieldErrors.maxLoadCapacity && <p className="text-sm text-destructive">{fieldErrors.maxLoadCapacity[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="odometer">Odometer (km)</Label>
              <Input
                id="odometer"
                type="number"
                value={formData.odometer}
                onChange={(e) => setFormData({ ...formData, odometer: parseFloat(e.target.value) || 0 })}
                placeholder="e.g., 45000"
              />
              {fieldErrors.odometer && <p className="text-sm text-destructive">{fieldErrors.odometer[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Acquisition Cost *</Label>
              <Input
                id="cost"
                type="number"
                value={formData.acquisitionCost}
                onChange={(e) => setFormData({ ...formData, acquisitionCost: parseFloat(e.target.value) || 0 })}
                placeholder="e.g., 35000"
              />
              {fieldErrors.acquisitionCost && <p className="text-sm text-destructive">{fieldErrors.acquisitionCost[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as VehicleStatus })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_STATUSES.map((s) => (
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
                {isSubmitting ? "Saving..." : editingVehicle ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vehicle Documents Dialog */}
      <Dialog open={!!docsVehicle} onOpenChange={(open) => !open && setDocsVehicle(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Documents — {docsVehicle?.registrationNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isLoadingDocs ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents on file for this vehicle.</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => {
                  const expired = doc.expiryDate ? new Date(doc.expiryDate) < new Date() : false;
                  return (
                    <div key={doc.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{doc.docType.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {doc.documentNumber ? `${doc.documentNumber} · ` : ""}
                          {doc.expiryDate ? (
                            <span className={expired ? "text-destructive" : ""}>
                              Expires {formatDate(doc.expiryDate)}
                            </span>
                          ) : (
                            "No expiry"
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a href={doc.documentUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" title="Open document">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deletingDocId === doc.id}
                          onClick={() => handleDeleteDocument(doc.id)}
                          title="Delete document"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium">Add Document</p>
              <div className="space-y-2">
                <Label htmlFor="docType">Type</Label>
                <Select value={docFormData.docType} onValueChange={(value) => setDocFormData({ ...docFormData, docType: value as DocumentType })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="docNumber">Document Number</Label>
                <Input
                  id="docNumber"
                  value={docFormData.documentNumber}
                  onChange={(e) => setDocFormData({ ...docFormData, documentNumber: e.target.value })}
                  placeholder="e.g., INS-2026-0042"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="docUrl">Document URL *</Label>
                <Input
                  id="docUrl"
                  value={docFormData.documentUrl}
                  onChange={(e) => setDocFormData({ ...docFormData, documentUrl: e.target.value })}
                  placeholder="https://..."
                />
                {docFieldErrors.documentUrl && <p className="text-sm text-destructive">{docFieldErrors.documentUrl[0]}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="docExpiry">Expiry Date</Label>
                <Input
                  id="docExpiry"
                  type="date"
                  value={docFormData.expiryDate}
                  onChange={(e) => setDocFormData({ ...docFormData, expiryDate: e.target.value })}
                />
              </div>
              <Button onClick={handleAddDocument} className="w-full" disabled={isAddingDoc}>
                {isAddingDoc ? "Adding..." : "Add Document"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
