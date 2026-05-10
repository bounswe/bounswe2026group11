import { useCallback, useEffect, useState } from 'react';
import type { PublicProfile } from '@/models/profile';
import { profileService } from '@/services/profileService';

export function usePublicProfileViewModel(userId: string | undefined) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setError('User id is missing.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await profileService.getPublicProfile(userId);
      setProfile(data);
    } catch (err: unknown) {
      setProfile(null);
      setError(err instanceof Error ? err.message : 'Failed to load public profile.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    isLoading,
    error,
    retry: fetchProfile,
  };
}
