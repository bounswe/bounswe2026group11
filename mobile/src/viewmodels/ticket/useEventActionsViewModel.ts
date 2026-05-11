import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/services/api';
import { getEventDetail } from '@/services/eventService';
import { listMyTickets } from '@/services/ticketService';
import type { EventDetail } from '@/models/event';
import type { TicketListItem } from '@/models/ticket';
import i18n from '@/i18n';

export interface EventActionsViewModel {
  event: EventDetail | null;
  ticket: TicketListItem | null;
  isLoading: boolean;
  errorMessage: string | null;
  primaryActionLabel: string | null;
  canOpenTicket: boolean;
  canScanTicket: boolean;
  canEditEvent: boolean;
  reload: () => Promise<void>;
}

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return i18n.t('tickets.actions.errors.loginRequired');
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  return i18n.t('tickets.actions.errors.loadFailed');
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
      setErrorMessage(i18n.t('tickets.actions.errors.loginRequired'));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const eventDetail = await getEventDetail(eventId, token);
      setEvent(eventDetail);

      const findTicket = (items: TicketListItem[]) => items.find((item) => item.event.id === eventId) ?? null;

      let ticketsResponse = await listMyTickets(token).catch(() => ({ items: [] }));
      let foundTicket = findTicket(ticketsResponse.items);

      // RETRY LOGIC: If joined a PUBLIC event but ticket is not yet in the list,
      // the server might still be processing the async ticket creation.
      // We retry up to 2 times with a 1s delay (3 attempts total).
      if (!foundTicket && eventDetail.viewer_context.participation_status === 'JOINED' && eventDetail.privacy_level === 'PUBLIC') {
        for (let i = 0; i < 2; i++) {
          await new Promise(r => setTimeout(r, 1000));
          ticketsResponse = await listMyTickets(token).catch(() => ({ items: [] }));
          foundTicket = findTicket(ticketsResponse.items);
          if (foundTicket) break;
        }
      }

      setTicket(foundTicket);
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
  const canEditEvent = Boolean(
    event?.viewer_context.is_host &&
      event.status === 'ACTIVE' &&
      new Date(event.start_time).getTime() > Date.now(),
  );

  const primaryActionLabel = useMemo(() => {
    if (canScanTicket) return i18n.t('tickets.actions.scanTicket');
    if (canOpenTicket) return i18n.t('tickets.actions.viewTicket');
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
    canEditEvent,
    reload,
  };
}
