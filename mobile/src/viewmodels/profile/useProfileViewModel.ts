import { useState, useCallback, useEffect } from 'react';
import { UserProfile } from '@/models/profile';
import type { ProfileEventSummary } from '@/models/profile';
import {
  getMyCompletedEvents,
  getMyHostedEvents,
  getMyProfile,
  getMyUpcomingEvents,
} from '@/services/profileService';
import { ApiError } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

export interface ProfileEventItem {
  id: string;
  title: string;
  start_time: string;
  end_time?: string | null;
  image_url?: string | null;
  category_label: string;
}

export interface ProfileViewModel {
  profile: UserProfile | null;
  isLoading: boolean;
  apiError: string | null;
  primaryName: string;
  secondaryName: string | null;
  avatarInitial: string;
  hostedEvents: ProfileEventItem[];
  attendedEvents: ProfileEventItem[];
  hostedCount: number;
  attendedCount: number;
  refresh: () => Promise<void>;
}

function normalizeEndTime(value?: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Some profile-event endpoints serialize missing end times as Go's zero time.
  if (trimmed.startsWith('0001-01-01')) return null;

  return trimmed;
}

function mapHostedEvent(event: ProfileEventSummary): ProfileEventItem {
  return {
    id: event.id,
    title: event.title,
    start_time: event.start_time,
    end_time: normalizeEndTime(event.end_time),
    image_url: event.image_url ?? null,
    category_label: event.category ?? 'Event',
  };
}

function mapProfileEvent(event: ProfileEventSummary): ProfileEventItem {
  return {
    id: event.id,
    title: event.title,
    start_time: event.start_time,
    end_time: normalizeEndTime(event.end_time),
    image_url: event.image_url ?? null,
    category_label: event.category ?? 'Event',
  };
}

function mergeEventsById(...groups: ProfileEventSummary[][]): ProfileEventItem[] {
  const seen = new Set<string>();
  const merged: ProfileEventItem[] = [];

  for (const group of groups) {
    for (const event of group) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      merged.push(mapProfileEvent(event));
    }
  }

  return merged;
}

function excludeHostedEvents(
  events: ProfileEventItem[],
  hosted: ProfileEventItem[],
): ProfileEventItem[] {
  const hostedIds = new Set(hosted.map((event) => event.id));
  return events.filter((event) => !hostedIds.has(event.id));
}

export function useProfileViewModel(): ProfileViewModel {
  const { token } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hostedEvents, setHostedEvents] = useState<ProfileEventItem[]>([]);
  const [attendedEvents, setAttendedEvents] = useState<ProfileEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchProfile = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!token) {
        setProfile(null);
        setApiError('You must be logged in to view your profile.');
        setIsLoading(false);
        return;
      }

      if (mode === 'initial') setIsLoading(true);
      setApiError(null);

      try {
        const [profileResult, hostedResult, upcomingResult, completedResult] = await Promise.all([
          getMyProfile(token),
          getMyHostedEvents(token),
          getMyUpcomingEvents(token),
          getMyCompletedEvents(token),
        ]);
        setProfile(profileResult);
        const mappedHostedEvents = hostedResult.events.map(mapHostedEvent);
        setHostedEvents(mappedHostedEvents);
        setAttendedEvents(
          excludeHostedEvents(
            mergeEventsById(upcomingResult.events, completedResult.events),
            mappedHostedEvents,
          ),
        );
      } catch (err) {
        if (err instanceof ApiError) {
          setApiError(err.message);
        } else {
          setApiError('Failed to load profile. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void fetchProfile('initial');
  }, [token]);

  const refresh = useCallback(async () => {
    await fetchProfile('refresh');
  }, [fetchProfile]);

  const primaryName = profile?.display_name ?? profile?.username ?? '';
  const secondaryName = profile?.display_name ? profile.username : null;
  const avatarInitial = primaryName.trim().charAt(0).toUpperCase() || '?';

  return {
    profile,
    isLoading,
    apiError,
    primaryName,
    secondaryName,
    avatarInitial,
    hostedEvents,
    attendedEvents,
    hostedCount: hostedEvents.length,
    attendedCount: attendedEvents.length,
    refresh,
  };
}
