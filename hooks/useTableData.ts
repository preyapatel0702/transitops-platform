"use client";

import { useState, useMemo, useCallback } from "react";

export interface TableState {
  pageIndex: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  filters?: Record<string, any>;
}

export const useTableData = <T extends Record<string, any>>(
  data: T[],
  defaultPageSize = 10
) => {
  const [tableState, setTableState] = useState<TableState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
    sortBy: undefined,
    sortOrder: "asc",
    search: "",
    filters: {},
  });

  // Filter data based on search and filters
  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply search filter
    if (tableState.search) {
      const searchLower = tableState.search.toLowerCase();
      result = result.filter((item) =>
        Object.values(item).some(
          (value) =>
            value &&
            value.toString().toLowerCase().includes(searchLower)
        )
      );
    }

    // Apply custom filters
    if (tableState.filters && Object.keys(tableState.filters || {}).length > 0) {
      result = result.filter((item) => {
        return Object.entries(tableState.filters || {}).every(([key, value]) => {
          if (!value) return true;
          return item[key] === value;
        });
      });
    }

    return result;
  }, [data, tableState.search, tableState.filters]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!tableState.sortBy) return filteredData;

    const sorted = [...filteredData].sort((a, b) => {
      const aVal = a[tableState.sortBy!];
      const bVal = b[tableState.sortBy!];

      if (aVal === bVal) return 0;

      const comparison = aVal < bVal ? -1 : 1;
      return tableState.sortOrder === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [filteredData, tableState.sortBy, tableState.sortOrder]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = tableState.pageIndex * tableState.pageSize;
    const endIndex = startIndex + tableState.pageSize;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, tableState.pageIndex, tableState.pageSize]);

  const totalPages = Math.ceil(sortedData.length / tableState.pageSize);

  const setSearch = useCallback((search: string) => {
    setTableState((prev) => ({
      ...prev,
      search,
      pageIndex: 0, // Reset to first page
    }));
  }, []);

  const setSort = useCallback((sortBy: string, sortOrder?: "asc" | "desc") => {
    setTableState((prev) => ({
      ...prev,
      sortBy,
      sortOrder: sortOrder || (prev.sortBy === sortBy && prev.sortOrder === "asc" ? "desc" : "asc"),
    }));
  }, []);

  const setFilters = useCallback((filters: Record<string, any>) => {
    setTableState((prev) => ({
      ...prev,
      filters,
      pageIndex: 0, // Reset to first page
    }));
  }, []);

  const setPageIndex = useCallback((pageIndex: number) => {
    setTableState((prev) => ({
      ...prev,
      pageIndex: Math.max(0, Math.min(pageIndex, totalPages - 1)),
    }));
  }, [totalPages]);

  const setPageSize = useCallback((pageSize: number) => {
    setTableState((prev) => ({
      ...prev,
      pageSize,
      pageIndex: 0, // Reset to first page
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setTableState({
      pageIndex: 0,
      pageSize: defaultPageSize,
      sortBy: undefined,
      sortOrder: "asc",
      search: "",
      filters: {},
    });
  }, [defaultPageSize]);

  return {
    data: paginatedData,
    filteredData: sortedData,
    totalItems: sortedData.length,
    totalPages,
    pageIndex: tableState.pageIndex,
    pageSize: tableState.pageSize,
    search: tableState.search,
    sortBy: tableState.sortBy,
    sortOrder: tableState.sortOrder,
    filters: tableState.filters,
    setSearch,
    setSort,
    setFilters,
    setPageIndex,
    setPageSize,
    resetFilters,
    hasNextPage: tableState.pageIndex < totalPages - 1,
    hasPreviousPage: tableState.pageIndex > 0,
  };
};
