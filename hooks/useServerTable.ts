"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionResult } from "@/utils/api-response";

/**
 * Drives a table backed by a server action that performs search/filter/sort
 * on the server (Prisma). Pagination is intentionally left to the caller's
 * UI (DataTable already paginates client-side over the returned rows) since
 * none of the list actions currently accept skip/take.
 *
 * `filters` changes (search, status, sortBy, sortOrder, ...) automatically
 * trigger a refetch. Use `refetch()` after a mutation (create/update/delete)
 * to resync with the server.
 */
export function useServerTable<TRow, TFilters extends Record<string, any>>(
  fetcher: (filters: TFilters) => Promise<ActionResult<TRow[]>>,
  initialFilters: TFilters
) {
  const [data, setData] = useState<TRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TFilters>(initialFilters);

  // Avoid setting state after a later request has already resolved.
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async (f: TFilters) => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetcherRef.current(f);
      if (id !== requestId.current) return;
      if (res.success) {
        setData(res.data ?? []);
      } else {
        setError(res.error || "Failed to load data");
      }
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const refetch = useCallback(() => load(filters), [load, filters]);

  const updateFilters = useCallback((patch: Partial<TFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  return { data, isLoading, error, filters, setFilters, updateFilters, refetch };
}

/**
 * Debounces a fast-changing value (e.g. a search input) so we don't fire a
 * server action on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
