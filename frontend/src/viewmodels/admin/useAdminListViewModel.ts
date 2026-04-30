import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/services/api';
import type { AdminListResponse, AdminPageParams } from '@/models/admin';

const DEFAULT_LIMIT = 25;

export type AdminFilters = object;

interface UseAdminListOptions<TItem, TFilters extends AdminFilters> {
  token: string | null;
  initialFilters: TFilters;
  fetchPage: (
    token: string,
    params: AdminPageParams & TFilters,
  ) => Promise<AdminListResponse<TItem>>;
}

export function useAdminListViewModel<TItem, TFilters extends AdminFilters>({
  token,
  initialFilters,
  fetchPage,
}: UseAdminListOptions<TItem, TFilters>) {
  const [filters, setFilters] = useState<TFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<TFilters>(initialFilters);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<TItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(
    () => ({ ...appliedFilters, limit, offset }) as AdminPageParams & TFilters,
    [appliedFilters, limit, offset],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchPage(token, params);
      setItems(data.items ?? []);
      setTotalCount(data.total_count ?? 0);
      setHasNext(Boolean(data.has_next));
    } catch (err) {
      setItems([]);
      setTotalCount(0);
      setHasNext(false);
      setError(err instanceof ApiError ? err.message : 'Failed to load admin data.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage, params, token]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = useCallback(<K extends keyof TFilters>(key: K, value: TFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const applyFilters = useCallback(() => {
    setOffset(0);
    setAppliedFilters(filters);
  }, [filters]);

  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setOffset(0);
  }, [initialFilters]);

  const nextPage = useCallback(() => {
    if (hasNext) setOffset((current) => current + limit);
  }, [hasNext, limit]);

  const previousPage = useCallback(() => {
    setOffset((current) => Math.max(0, current - limit));
  }, [limit]);

  const changeLimit = useCallback((nextLimit: number) => {
    setLimit(nextLimit);
    setOffset(0);
  }, []);

  return {
    filters,
    items,
    totalCount,
    hasNext,
    isLoading,
    error,
    limit,
    offset,
    setFilter,
    applyFilters,
    clearFilters,
    nextPage,
    previousPage,
    changeLimit,
    retry: load,
  };
}
