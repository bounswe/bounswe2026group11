import React, { useCallback, useEffect, useState } from 'react';
import {
  MyEventStatus,
  MyEventSummary,
} from '@/models/event';
import { useAuth } from '@/contexts/AuthContext';
import { listMyEvents } from '@/services/eventService';
import { listMyInvitations, acceptInvitation, declineInvitation } from '@/services/invitationService';
import { ReceivedInvitation } from '@/models/invitation';
import { ApiError } from '@/services/api';

type ExtendedStatus = MyEventStatus | 'INVITATIONS';

const STATUS_OPTIONS: Array<{ value: ExtendedStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'INVITATIONS', label: 'Invites' },
  { value: 'CANCELED', label: 'Canceled' },
];

const EMPTY_STATE_COPY: Record<
  MyEventStatus,
  { title: string; subtitle: string }
> = {
  ACTIVE: {
    title: 'No active events right now',
    subtitle: 'Hosted plans and upcoming participations will appear here.',
  },
  IN_PROGRESS: {
    title: 'Nothing is in progress',
    subtitle: 'Events that are currently happening will show up here.',
  },
  COMPLETED: {
    title: 'No completed events yet',
    subtitle: 'Your hosted wrap-ups and participation history will build here.',
  },
  CANCELED: {
    title: 'No canceled events',
    subtitle: 'Canceled hosted or attended events will appear here when needed.',
  },
};

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

export function useMyEventsViewModel(): MyEventsViewModel {
  const { token } = useAuth();

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
      setErrorMessage('You must be logged in to manage your events.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [eventsResponse, invitationsResponse] = await Promise.all([
        listMyEvents(token),
        listMyInvitations(token),
      ]);
      setHostedEvents(eventsResponse.hosted_events);
      setAttendedEvents(eventsResponse.attended_events);
      setInvitations(invitationsResponse.items);
      setInvitationCount(invitationsResponse.items.length);
    } catch {
      setHostedEvents([]);
      setAttendedEvents([]);
      setInvitations([]);
      setInvitationCount(0);
      setErrorMessage('Failed to load your events. Please try again.');
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
    return { ...statusOption, count };
  });

  const hasAnyEvents = allEvents.length > 0 || invitations.length > 0;

  let emptyTitle = 'No events to manage yet';
  let emptySubtitle = 'Events you host or join will appear here once your plans start coming together.';

  if (activeStatus === 'INVITATIONS') {
    emptyTitle = 'No invitations yet';
    emptySubtitle = 'Private event invites from your friends and hosts will appear here.';
  } else if (hasAnyEvents) {
    const currentStatus = activeStatus as MyEventStatus;
    emptyTitle = EMPTY_STATE_COPY[currentStatus].title;
    emptySubtitle = EMPTY_STATE_COPY[currentStatus].subtitle;
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
