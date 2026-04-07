import { useState, useEffect, useCallback } from 'react';
import { profileService } from '@/services/profileService';
import type { EventSummary } from '@/models/profile';
import { ApiError } from '@/services/api';

export type MyEventsTab = 'organized' | 'upcoming' | 'active' | 'past' | 'canceled';

export function useMyEventsViewModel(token: string | null) {
  const [organized, setOrganized] = useState<EventSummary[]>([]);
  const [upcoming, setUpcoming] = useState<EventSummary[]>([]);
  const [active, setActive] = useState<EventSummary[]>([]);
  const [past, setPast] = useState<EventSummary[]>([]);
  const [canceled, setCanceled] = useState<EventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MyEventsTab>('active');

  const fetchEvents = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const [hosted, upAndActive, completed, canceled_] = await Promise.all([
        profileService.getHostedEvents(token),
        profileService.getUpcomingEvents(token),
        profileService.getCompletedEvents(token),
        profileService.getCanceledEvents(token),
      ]);

      setOrganized(hosted);
      setUpcoming(upAndActive.filter((e) => e.status === 'ACTIVE'));
      setActive(upAndActive.filter((e) => e.status === 'IN_PROGRESS'));
      setPast(completed);
      setCanceled(canceled_);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load your events. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    organized,
    upcoming,
    active,
    past,
    canceled,
    isLoading,
    error,
    activeTab,
    setActiveTab,
    retry: fetchEvents,
  };
}
