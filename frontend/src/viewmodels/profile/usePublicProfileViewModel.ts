import { useCallback, useEffect, useState } from 'react';
import type { PublicProfile } from '@/models/profile';
import { profileService } from '@/services/profileService';
import i18n from '@/i18n';

export function usePublicProfileViewModel(userId: string | undefined) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setError(i18n.t('errors.public_profile_user_id_missing'));
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
      setError(err instanceof Error ? err.message : i18n.t('errors.public_profile_load_failed'));
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
