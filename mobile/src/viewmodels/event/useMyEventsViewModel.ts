import React, { useEffect, useState } from 'react';
import {
  MyEventStatus,
  MyEventSummary,
} from '@/models/event';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { listMyEvents } from '@/services/eventService';
import { ApiError } from '@/services/api';
import { listMyTickets } from '@/services/ticketService';
import type { TicketListItem } from '@/models/ticket';
import i18n from '@/i18n';

const STATUS_OPTIONS: Array<{ value: MyEventStatus; labelKey: string }> = [
  { value: 'ACTIVE', labelKey: 'events.status.ACTIVE' },
  { value: 'IN_PROGRESS', labelKey: 'events.status.IN_PROGRESS' },
  { value: 'COMPLETED', labelKey: 'events.status.COMPLETED' },
  { value: 'CANCELED', labelKey: 'events.status.CANCELED' },
];

function getEmptyStateCopy(status: MyEventStatus): { title: string; subtitle: string } {
  return {
    title: i18n.t(`myEvents.empty.${status}.title`),
    subtitle: i18n.t(`myEvents.empty.${status}.subtitle`),
  };
}

export interface MyEventsStatusTab {
  value: MyEventStatus;
  label: string;
  count: number;
}



export interface MyEventsViewModel {
  activeStatus: MyEventStatus;
  statusTabs: MyEventsStatusTab[];
  hostedEvents: MyEventSummary[];
  attendedEvents: MyEventSummary[];
  visibleEvents: MyEventSummary[];
  hostedCount: number;
  attendedCount: number;
  isLoading: boolean;
  errorMessage: string | null;
  canRetry: boolean;
  emptyTitle: string;
  emptySubtitle: string;
  setActiveStatus: (status: MyEventStatus) => void;
  reload: () => Promise<void>;
}

function getTimeValue(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortVisibleEvents(
  events: MyEventSummary[],
  status: MyEventStatus,
): MyEventSummary[] {
  const sorted = [...events];

  sorted.sort((first, second) => {
    const firstTime = getTimeValue(first.start_time);
    const secondTime = getTimeValue(second.start_time);

    if (firstTime !== secondTime) {
      return status === 'ACTIVE' || status === 'IN_PROGRESS'
        ? firstTime - secondTime
        : secondTime - firstTime;
    }

    if (first.relation !== second.relation) {
      return first.relation === 'HOSTING' ? -1 : 1;
    }

    return first.title.localeCompare(second.title);
  });

  return sorted;
}

export function useMyEventsViewModel(): MyEventsViewModel {
  const { token } = useAuth();
  // Subscribe to locale so tab labels and empty-state copy re-render on language change.
  useTranslation();

  const [activeStatus, setActiveStatus] = useState<MyEventStatus>('ACTIVE');
  const [hostedEvents, setHostedEvents] = useState<MyEventSummary[]>([]);
  const [attendedEvents, setAttendedEvents] = useState<MyEventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = React.useCallback(async () => {
    if (!token) {
      setHostedEvents([]);
      setAttendedEvents([]);
      setErrorMessage(i18n.t('myEvents.errors.loginRequired'));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const withTimeout = <T>(promise: Promise<T>, timeoutMs = 10000): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out')), timeoutMs)
        ),
      ]);
    };

    try {
      const [eventsResponse, ticketsResponse] = await Promise.all([
        withTimeout(listMyEvents(token)),
        withTimeout(listMyTickets(token)).catch(() => ({ items: [] })),
      ]);

      const ticketsByEventId = new Map<string, TicketListItem>();
      for (const ticket of ticketsResponse?.items ?? []) {
        if (ticket?.event?.id) {
          ticketsByEventId.set(ticket.event.id, ticket);
        }
      }

      const decoratedAttendedEvents = (eventsResponse?.attended_events ?? []).map((event) => {
        const ticket = ticketsByEventId.get(event.id);
        if (!ticket) return event;

        const badges = event.badges.some((badge) => badge.type === 'TICKET')
          ? event.badges
          : [...event.badges, { type: 'TICKET' as const, label: i18n.t('tickets.detail.title') }];

        return {
          ...event,
          ticket_id: ticket.ticket_id,
          ticket_status: ticket.status,
          badges,
        };
      });

      const nextHostedEvents = eventsResponse?.hosted_events ?? [];

      setHostedEvents(nextHostedEvents);
      setAttendedEvents(decoratedAttendedEvents);
    } catch (error) {
      console.error('Failed to load events:', error);
      setHostedEvents([]);
      setAttendedEvents([]);
      
      const message = error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : i18n.t('myEvents.errors.loadFailed');
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [token]);

  const allEvents = [...hostedEvents, ...attendedEvents];
  const visibleEvents = sortVisibleEvents(
    allEvents.filter((event) => event.status === activeStatus),
    activeStatus,
  );

  const statusTabs = STATUS_OPTIONS.map((statusOption) => {
    const count = allEvents.filter((event) => event.status === statusOption.value).length;
    return {
      value: statusOption.value,
      label: i18n.t(statusOption.labelKey),
      count,
    };
  });

  const hasAnyEvents = allEvents.length > 0;

  let emptyTitle = i18n.t('myEvents.noEventsTitle');
  let emptySubtitle = i18n.t('myEvents.noEventsSubtitle');

  if (hasAnyEvents) {
    const currentStatus = activeStatus;
    const copy = getEmptyStateCopy(currentStatus);
    emptyTitle = copy.title;
    emptySubtitle = copy.subtitle;
  }

  return {
    activeStatus,
    statusTabs,
    hostedEvents,
    attendedEvents,
    visibleEvents,
    hostedCount: hostedEvents.length,
    attendedCount: attendedEvents.length,
    isLoading,
    errorMessage,
    canRetry: Boolean(token),
    emptyTitle,
    emptySubtitle,
    setActiveStatus,
    reload,
  };
}
