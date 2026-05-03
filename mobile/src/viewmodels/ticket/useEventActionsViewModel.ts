import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/services/api';
import { getEventDetail } from '@/services/eventService';
import { listMyTickets } from '@/services/ticketService';
import type { EventDetail } from '@/models/event';
import type { TicketListItem } from '@/models/ticket';

export interface EventActionsViewModel {
  event: EventDetail | null;
  ticket: TicketListItem | null;
  isLoading: boolean;
  errorMessage: string | null;
  primaryActionLabel: string | null;
  canOpenTicket: boolean;
  canScanTicket: boolean;
  reload: () => Promise<void>;
}

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'You must be logged in to manage tickets for this event.';
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  return 'Failed to load event actions. Please try again.';
}

export function useEventActionsViewModel(eventId: string): EventActionsViewModel {
  const { token } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [ticket, setTicket] = useState<TicketListItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) {
      setEvent(null);
      setTicket(null);
      setErrorMessage('You must be logged in to manage tickets for this event.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [eventDetail, ticketsResponse] = await Promise.all([
        getEventDetail(eventId, token),
        listMyTickets(token),
      ]);

      setEvent(eventDetail);
      setTicket(ticketsResponse.items.find((item) => item.event.id === eventId) ?? null);
    } catch (error) {
      setEvent(null);
      setTicket(null);
      setErrorMessage(getLoadErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [eventId, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const canScanTicket = Boolean(event?.viewer_context.is_host);
  const canOpenTicket = !canScanTicket && ticket != null;

  const primaryActionLabel = useMemo(() => {
    if (canScanTicket) return 'Scan Ticket';
    if (canOpenTicket) return 'View Ticket';
    return null;
  }, [canOpenTicket, canScanTicket]);

  return {
    event,
    ticket,
    isLoading,
    errorMessage,
    primaryActionLabel,
    canOpenTicket,
    canScanTicket,
    reload,
  };
}
