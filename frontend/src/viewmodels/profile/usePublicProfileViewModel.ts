import { useCallback, useEffect, useState } from 'react';
import type { EarnedBadge, PublicProfile } from '@/models/profile';
import { profileService } from '@/services/profileService';
import i18n from '@/i18n';

export function usePublicProfileViewModel(
  userId: string | undefined,
  authToken: string | null | undefined,
) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [earnedBadgesLoading, setEarnedBadgesLoading] = useState(false);
  const [earnedBadgesError, setEarnedBadgesError] = useState<string | null>(null);

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

  const fetchEarnedBadges = useCallback(async () => {
    if (!userId || !authToken) {
      setEarnedBadges([]);
      setEarnedBadgesError(null);
      setEarnedBadgesLoading(false);
      return;
    }

    setEarnedBadgesLoading(true);
    setEarnedBadgesError(null);
    try {
      const res = await profileService.getUserBadges(userId, authToken);
      setEarnedBadges(res.items ?? []);
    } catch (err: unknown) {
      setEarnedBadges([]);
      setEarnedBadgesError(
        err instanceof Error ? err.message : i18n.t('errors.profile_badges_failed'),
      );
    } finally {
      setEarnedBadgesLoading(false);
    }
  }, [userId, authToken]);

  useEffect(() => {
    void fetchEarnedBadges();
  }, [fetchEarnedBadges]);

  return {
    profile,
    isLoading,
    error,
    retry: fetchProfile,
    earnedBadges,
    earnedBadgesLoading,
    earnedBadgesError,
    refreshEarnedBadges: fetchEarnedBadges,
  };
}
