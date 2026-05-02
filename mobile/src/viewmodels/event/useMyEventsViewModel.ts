import React, { useCallback, useEffect, useState } from 'react';
import {
  MyEventStatus,
  MyEventSummary,
} from '@/models/event';
import { useAuth } from '@/contexts/AuthContext';
import { listMyEvents } from '@/services/eventService';

const STATUS_OPTIONS: Array<{ value: MyEventStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
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

  const [activeStatus, setActiveStatus] = useState<MyEventStatus>('ACTIVE');
  const [hostedEvents, setHostedEvents] = useState<MyEventSummary[]>([]);
  const [attendedEvents, setAttendedEvents] = useState<MyEventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
      const response = await listMyEvents(token);
      setHostedEvents(response.hosted_events);
      setAttendedEvents(response.attended_events);
    } catch {
      setHostedEvents([]);
      setAttendedEvents([]);
      setErrorMessage('Failed to load your events. Please try again.');
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

  const statusTabs = STATUS_OPTIONS.map((statusOption) => ({
    ...statusOption,
    count: allEvents.filter((event) => event.status === statusOption.value).length,
  }));

  const hasAnyEvents = allEvents.length > 0;
  const emptyTitle = hasAnyEvents
    ? EMPTY_STATE_COPY[activeStatus].title
    : 'No events to manage yet';
  const emptySubtitle = hasAnyEvents
    ? EMPTY_STATE_COPY[activeStatus].subtitle
    : 'Events you host or join will appear here once your plans start coming together.';

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
