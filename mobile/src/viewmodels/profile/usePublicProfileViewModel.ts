import { useState, useCallback, useEffect } from 'react';
import { PublicProfile, BadgeItem } from '@/models/profile';
import { 
  getPublicProfile,
  getUserBadges,
  getBadgeCatalog
} from '@/services/profileService';
import { ApiError } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import i18n from '@/i18n';

export interface PublicProfileViewModel {
  profile: PublicProfile | null;
  isLoading: boolean;
  error: string | null;
  primaryName: string;
  secondaryName: string | null;
  avatarInitial: string;
  overallRatingLabel: string;
  hostRatingLabel: string;
  participantRatingLabel: string;
  badges: BadgeItem[];
  catalogVisible: boolean;
  setCatalogVisible: (visible: boolean) => void;
  refresh: () => Promise<void>;
}

export function usePublicProfileViewModel(userId: string): PublicProfileViewModel {
  const { token } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalogVisible, setCatalogVisible] = useState(false);

  const fetchData = useCallback(async () => {
    if (!token) {
      setError(i18n.t('publicProfile.errors.loginRequired'));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [profileResult, catalogResult, earnedBadgesResult] = await Promise.all([
        getPublicProfile(userId, token),
        getBadgeCatalog(token),
        getUserBadges(userId, token).catch(() => ({ items: [] })) // Fallback if user badges fail
      ]);

      setProfile(profileResult);

      // Merge earned status
      const mergedBadges = (catalogResult.items || []).map((b: BadgeItem) => {
        const earned = (earnedBadgesResult.items || []).find((eb: BadgeItem) => eb.slug === b.slug);
        return {
          ...b,
          earned: !!earned,
          earned_at: earned?.earned_at || null,
        };
      });
      
      // In the public profile, only show badges that the user has actually earned
      setBadges(mergedBadges.filter(b => b.earned));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(i18n.t('publicProfile.errors.loadFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId, token]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const primaryName = profile?.display_name ?? profile?.username ?? '';
  const secondaryName = profile?.display_name ? profile.username : null;
  const avatarInitial = primaryName.trim().charAt(0).toUpperCase() || '?';

  const overallRatingLabel = profile?.final_score != null 
    ? profile.final_score.toFixed(1) 
    : i18n.t('profile.new');
  
  const hostRatingLabel = profile?.final_score != null // Note: Backend currently returns final_score but might need more specific host/participant count
    ? i18n.t('publicProfile.hostRatingCount', { count: profile.host_rating_count })
    : i18n.t('publicProfile.newHost');

  const participantRatingLabel = profile?.final_score != null
    ? i18n.t('publicProfile.guestRatingCount', { count: profile.participant_rating_count })
    : i18n.t('publicProfile.newGuest');

  return {
    profile,
    isLoading,
    error,
    primaryName,
    secondaryName,
    avatarInitial,
    overallRatingLabel,
    hostRatingLabel,
    participantRatingLabel,
    badges,
    catalogVisible,
    setCatalogVisible,
    refresh: fetchData,
  };
}
