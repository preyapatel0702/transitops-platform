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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Download, FileText, Edit2, Trash2, AlertCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue, useServerTable } from "@/hooks/useServerTable";
import { createExpense, updateExpense, deleteExpense, getExpenses } from "@/actions/expense.actions";
import { getVehicles } from "@/actions/vehicle.actions";
import type { Expense, ExpenseType, Vehicle } from "@/types";
import { formatDate, formatCurrency, exportToCSV } from "@/lib/helpers";
import { toast } from "sonner";

type ExpenseWithVehicle = Expense & { vehicle: Vehicle };

const EXPENSE_TYPES: ExpenseType[] = ["TOLL", "MAINTENANCE", "INSURANCE", "OTHER"];

interface ExpenseFilters {
  vehicleId?: string;
  expenseType?: string;
}

const emptyFormData = {
  vehicleId: "",
  expenseType: "TOLL" as ExpenseType,
  amount: 0,
  description: "",
  date: new Date().toISOString().split("T")[0],
};

export default function Expenses() {
  const { user, logout } = useAuth();

  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 400);

  const { data: expenses, isLoading, error, filters, updateFilters, refetch } = useServerTable<
    ExpenseWithVehicle,
    ExpenseFilters
  >(getExpenses as any, {});

  const filteredExpenses = useMemo(() => {
    if (!search) return expenses;
    const q = search.toLowerCase();
    return expenses.filter(
      (e) =>
        e.vehicle?.registrationNumber?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q)
    );
  }, [expenses, search]);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  useEffect(() => {
    getVehicles({}).then((res) => {
      if (res.success) setVehicles(res.data);
    });
  }, []);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseWithVehicle | null>(null);
  const [formData, setFormData] = useState(emptyFormData);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const columns: ColumnDef<ExpenseWithVehicle>[] = useMemo(
    () => [
      {
        id: "vehicle",
        header: "Vehicle",
        cell: ({ row }) => row.original.vehicle?.registrationNumber || "N/A",
      },
      { accessorKey: "expenseType", header: "Type" },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => formatCurrency(row.original.amount),
      },
      { accessorKey: "description", header: "Description" },
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => formatDate(row.original.date),
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
              disabled={deletingId === row.original.id}
              onClick={() => handleDelete(row.original.id)}
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
    setEditingExpense(null);
    setFormData(emptyFormData);
    setFieldErrors({});
    setIsDialogOpen(true);
  };

  const handleEdit = (expense: ExpenseWithVehicle) => {
    setEditingExpense(expense);
    setFormData({
      vehicleId: expense.vehicleId,
      expenseType: expense.expenseType,
      amount: expense.amount,
      description: expense.description,
      date: new Date(expense.date).toISOString().split("T")[0],
    });
    setFieldErrors({});
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this expense? This cannot be undone.")) return;
    setDeletingId(id);
    const res = await deleteExpense(id);
    setDeletingId(null);
    if (res.success) {
      toast.success("Expense deleted successfully");
      refetch();
    } else {
      toast.error(res.error || "Failed to delete expense");
    }
  };

  const handleSubmit = async () => {
    if (!formData.vehicleId || !formData.amount || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});

    const res = editingExpense
      ? await updateExpense({
          id: editingExpense.id,
          expenseType: formData.expenseType,
          amount: formData.amount,
          description: formData.description,
          date: new Date(formData.date),
        })
      : await createExpense({
          vehicleId: formData.vehicleId,
          expenseType: formData.expenseType,
          amount: formData.amount,
          description: formData.description,
          date: new Date(formData.date),
        });

    setIsSubmitting(false);

    if (res.success) {
      toast.success(editingExpense ? "Expense updated successfully" : "Expense created successfully");
      setIsDialogOpen(false);
      refetch();
    } else {
      toast.error(res.error || "Failed to save expense");
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
    }
  };

  const handleExportCSV = () => {
    const exportData = filteredExpenses.map((e) => ({
      Vehicle: e.vehicle?.registrationNumber || "N/A",
      Type: e.expenseType,
      Amount: formatCurrency(e.amount),
      Description: e.description,
      Date: formatDate(e.date),
    }));
    exportToCSV(exportData, "expenses");
    toast.success("Exported to CSV");
  };

  const handleExportPDF = () => {
    window.open("/api/export/pdf?entity=expenses", "_blank");
  };

  const resetFilters = () => {
    setRawSearch("");
    updateFilters({ vehicleId: undefined, expenseType: undefined });
  };

  return (
    <DashboardLayout onLogout={handleLogout} userName={user?.name || "User"} userRole={user?.role}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Expenses</h1>
            <p className="text-muted-foreground mt-2">Track vehicle expenses and costs</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV} disabled={filteredExpenses.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" onClick={handleExportPDF}>
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button onClick={handleOpenDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New Expense
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
                value={filters.expenseType || "all"}
                onValueChange={(value) => updateFilters({ expenseType: value === "all" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {EXPENSE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
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
                <AlertTitle>Failed to load expenses</AlertTitle>
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
              <DataTable columns={columns} data={filteredExpenses} emptyMessage="No expenses found" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Create New Expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehicle *</Label>
              <Select
                value={formData.vehicleId}
                onValueChange={(value) => setFormData({ ...formData, vehicleId: value })}
                disabled={!!editingExpense}
              >
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
              <Label htmlFor="type">Expense Type</Label>
              <Select value={formData.expenseType} onValueChange={(value) => setFormData({ ...formData, expenseType: value as ExpenseType })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                placeholder="e.g., 50.00"
              />
              {fieldErrors.amount && <p className="text-sm text-destructive">{fieldErrors.amount[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Highway toll - Route 101"
                rows={3}
              />
              {fieldErrors.description && <p className="text-sm text-destructive">{fieldErrors.description[0]}</p>}
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
                {isSubmitting ? "Saving..." : editingExpense ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
