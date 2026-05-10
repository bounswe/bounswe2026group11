import React, { useCallback, useEffect, useState } from 'react';
import {
  MyEventStatus,
  MyEventSummary,
} from '@/models/event';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { listMyEvents } from '@/services/eventService';
import { listMyInvitations, acceptInvitation, declineInvitation } from '@/services/invitationService';
import { ReceivedInvitation } from '@/models/invitation';
import { ApiError } from '@/services/api';
import { listMyTickets } from '@/services/ticketService';
import type { TicketListItem } from '@/models/ticket';
import i18n from '@/i18n';

type ExtendedStatus = MyEventStatus | 'INVITATIONS';

const STATUS_OPTIONS: Array<{ value: ExtendedStatus; labelKey: string }> = [
  { value: 'ACTIVE', labelKey: 'events.status.ACTIVE' },
  { value: 'IN_PROGRESS', labelKey: 'events.status.IN_PROGRESS' },
  { value: 'COMPLETED', labelKey: 'events.status.COMPLETED' },
  { value: 'INVITATIONS', labelKey: 'myEvents.invitations' },
  { value: 'CANCELED', labelKey: 'events.status.CANCELED' },
];

function getEmptyStateCopy(status: MyEventStatus): { title: string; subtitle: string } {
  return {
    title: i18n.t(`myEvents.empty.${status}.title`),
    subtitle: i18n.t(`myEvents.empty.${status}.subtitle`),
  };
}

export interface MyEventsStatusTab {
  value: ExtendedStatus;
  label: string;
  count: number;
}



export interface MyEventsViewModel {
  activeStatus: ExtendedStatus;
  statusTabs: MyEventsStatusTab[];
  hostedEvents: MyEventSummary[];
  attendedEvents: MyEventSummary[];
  invitations: ReceivedInvitation[];
  visibleEvents: MyEventSummary[];
  hostedCount: number;
  attendedCount: number;
  invitationCount: number;
  isLoading: boolean;
  isActionLoading: string | null;
  errorMessage: string | null;
  canRetry: boolean;
  emptyTitle: string;
  emptySubtitle: string;
  setActiveStatus: (status: ExtendedStatus) => void;
  reload: () => Promise<void>;
  handleAccept: (invitationId: string) => Promise<void>;
  handleDecline: (invitationId: string) => Promise<void>;
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

function normalizeInvitationsResponse(
  response: { pending?: ReceivedInvitation[]; items?: ReceivedInvitation[] } | null | undefined,
): ReceivedInvitation[] {
  if (Array.isArray(response?.pending)) return response.pending;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

export function useMyEventsViewModel(): MyEventsViewModel {
  const { token } = useAuth();
  // Subscribe to locale so the tab labels and empty-state copy re-render on language change.
  useTranslation();

  const [activeStatus, setActiveStatus] = useState<ExtendedStatus>('ACTIVE');
  const [hostedEvents, setHostedEvents] = useState<MyEventSummary[]>([]);
  const [attendedEvents, setAttendedEvents] = useState<MyEventSummary[]>([]);
  const [invitations, setInvitations] = useState<ReceivedInvitation[]>([]);
  const [invitationCount, setInvitationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = React.useCallback(async () => {
    if (!token) {
      setHostedEvents([]);
      setAttendedEvents([]);
      setInvitations([]);
      setInvitationCount(0);
      setErrorMessage('You must be logged in to manage your events.');
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
      const [eventsResponse, invitationsResponse, ticketsResponse] = await Promise.all([
        withTimeout(listMyEvents(token)),
        withTimeout(listMyInvitations(token)).catch(() => ({ pending: [] })),
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
          : [...event.badges, { type: 'TICKET' as const, label: 'Ticket' }];

        return {
          ...event,
          ticket_id: ticket.ticket_id,
          ticket_status: ticket.status,
          badges,
        };
      });

      const nextHostedEvents = eventsResponse?.hosted_events ?? [];
      const nextInvitations = normalizeInvitationsResponse(invitationsResponse);

      setHostedEvents(nextHostedEvents);
      setAttendedEvents(decoratedAttendedEvents);
      setInvitations(nextInvitations);
      setInvitationCount(nextInvitations.length);
    } catch (error) {
      console.error('Failed to load events:', error);
      setHostedEvents([]);
      setAttendedEvents([]);
      setInvitations([]);
      setInvitationCount(0);
      
      const message = error instanceof ApiError ? error.message : 
                     error instanceof Error ? error.message : 
                     'Failed to load your events. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const handleAccept = useCallback(
    async (invitationId: string) => {
      if (!token) return;
      setIsActionLoading(invitationId);
      try {
        await acceptInvitation(invitationId, token);
        setInvitations((prev) => prev.filter((i) => i.invitation_id !== invitationId));
        setInvitationCount((prev) => prev - 1);
        await reload();
      } catch (err) {
        setErrorMessage(err instanceof ApiError ? err.message : 'Failed to accept invitation');
      } finally {
        setIsActionLoading(null);
      }
    },
    [token],
  );

  const handleDecline = useCallback(
    async (invitationId: string) => {
      if (!token) return;
      setIsActionLoading(invitationId);
      try {
        await declineInvitation(invitationId, token);
        setInvitations((prev) => prev.filter((i) => i.invitation_id !== invitationId));
        setInvitationCount((prev) => prev - 1);
      } catch (err) {
        setErrorMessage(err instanceof ApiError ? err.message : 'Failed to decline invitation');
      } finally {
        setIsActionLoading(null);
      }
    },
    [token],
  );

  useEffect(() => {
    void reload();
  }, [token]);

  const allEvents = [...hostedEvents, ...attendedEvents];
  const visibleEvents = activeStatus !== 'INVITATIONS'
    ? sortVisibleEvents(
      allEvents.filter((event) => event.status === activeStatus),
      activeStatus as MyEventStatus,
    )
    : [];

  const statusTabs = STATUS_OPTIONS.map((statusOption) => {
    let count = 0;
    if (statusOption.value === 'INVITATIONS') {
      count = invitationCount;
    } else {
      count = allEvents.filter((event) => event.status === statusOption.value).length;
    }
    return {
      value: statusOption.value,
      label: i18n.t(statusOption.labelKey),
      count,
    };
  });

  const hasAnyEvents = allEvents.length > 0 || invitations.length > 0;

  let emptyTitle = i18n.t('myEvents.noEventsTitle');
  let emptySubtitle = i18n.t('myEvents.noEventsSubtitle');

  if (activeStatus === 'INVITATIONS') {
    emptyTitle = i18n.t('myEvents.noInvitationsTitle');
    emptySubtitle = i18n.t('myEvents.noInvitationsSubtitle');
  } else if (hasAnyEvents) {
    const currentStatus = activeStatus as MyEventStatus;
    const copy = getEmptyStateCopy(currentStatus);
    emptyTitle = copy.title;
    emptySubtitle = copy.subtitle;
  }

  return {
    activeStatus,
    statusTabs,
    hostedEvents,
    attendedEvents,
    invitations,
    visibleEvents,
    hostedCount: hostedEvents.length,
    attendedCount: attendedEvents.length,
    invitationCount,
    isLoading,
    isActionLoading,
    errorMessage,
    canRetry: Boolean(token),
    emptyTitle,
    emptySubtitle,
    setActiveStatus,
    reload,
    handleAccept,
    handleDecline,
  };
}
