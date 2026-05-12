import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { listMyTickets } from '@/services/ticketService';
import type { TicketListItem } from '@/models/ticket';
import { ApiError } from '@/services/api';
import i18n from '@/i18n';

export interface TicketsViewModel {
  tickets: TicketListItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  dismissError: () => void;
}

export function useTicketsViewModel(): TicketsViewModel {
  const { token } = useAuth();
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) {
      setTickets([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await listMyTickets(token);
      setTickets(response.items ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : i18n.t('errors.tickets_load_failed'));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const dismissError = useCallback(() => setError(null), []);

  return { tickets, isLoading, error, refresh, dismissError };
}
