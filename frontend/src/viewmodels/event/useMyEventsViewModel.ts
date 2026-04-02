import { useState, useEffect, useCallback } from 'react';
import { profileService } from '@/services/profileService';
import type { EventSummary } from '@/models/profile';
import { ApiError } from '@/services/api';

export type MyEventsTab = 'organized' | 'upcoming' | 'past';

export function useMyEventsViewModel(token: string | null) {
  const [organized, setOrganized] = useState<EventSummary[]>([]);
  const [upcoming, setUpcoming] = useState<EventSummary[]>([]);
  const [past, setPast] = useState<EventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MyEventsTab>('organized');

  const fetchEvents = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const profile = await profileService.getMyProfile(token);
      const now = new Date();

      setOrganized(profile.created_events ?? []);

      const attended = profile.attended_events ?? [];
      setUpcoming(
        attended.filter((e) => new Date(e.start_time) >= now)
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
      );
      setPast(
        attended.filter((e) => new Date(e.start_time) < now)
          .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()),
      );
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
    past,
    isLoading,
    error,
    activeTab,
    setActiveTab,
    retry: fetchEvents,
  };
}
