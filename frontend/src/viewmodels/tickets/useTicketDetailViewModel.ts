import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getMyTicket } from '@/services/ticketService';
import type { TicketDetailResponse } from '@/models/ticket';
import { ApiError } from '@/services/api';
import i18n from '@/i18n';

export type TicketDetailStatus = 'loading' | 'ready' | 'not-found' | 'error';

export interface TicketDetailViewModel {
  ticket: TicketDetailResponse | null;
  status: TicketDetailStatus;
  errorMessage: string | null;
  refresh: () => Promise<void>;
}

export function useTicketDetailViewModel(
  ticketId: string | undefined,
): TicketDetailViewModel {
  const { token } = useAuth();
  const [ticket, setTicket] = useState<TicketDetailResponse | null>(null);
  const [status, setStatus] = useState<TicketDetailStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!ticketId || !token) {
      setStatus('not-found');
      return;
    }
    setStatus('loading');
    setErrorMessage(null);
    try {
      const response = await getMyTicket(ticketId, token);
      setTicket(response);
      setStatus('ready');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setStatus('not-found');
        } else {
          setStatus('error');
          setErrorMessage(err.message);
        }
      } else {
        setStatus('error');
        setErrorMessage(i18n.t('errors.ticket_detail_load_failed'));
      }
    }
  }, [ticketId, token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ticket, status, errorMessage, refresh };
}
