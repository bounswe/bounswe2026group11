import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { UserProfile } from '@/models/profile';
import type { ProfileEventSummary } from '@/models/profile';
import type { PrivacyLevel } from '@/models/event';
import {
  confirmProfileAvatarUpload,
  getMyCanceledEvents,
  getMyCompletedEvents,
  getMyHostedEvents,
  getMyProfile,
  getProfileAvatarUploadUrl,
  getMyUpcomingEvents,
  getMyEquipment,
  getMyBadges,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  getShowcaseImageUploadUrl,
  confirmShowcaseImageUpload,
  deleteShowcaseImage,
  updateMyProfile,
  getBadgeCatalog,
  getPublicProfile,
  getUserBadges,
} from '@/services/profileService';
import { BadgeItem, EquipmentItem, ShowcaseImageItem } from '@/models/profile';
import { ApiError } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { uploadFileToPresignedUrl } from '@/services/eventService';
import { acceptInvitation, declineInvitation, listMyInvitations } from '@/services/invitationService';
import type { ReceivedInvitation } from '@/models/invitation';
import { shouldShowProfileEvent } from '@/utils/eventStatus';
import i18n from '@/i18n';

export interface ProfileEventItem {
  id: string;
  title: string;
  start_time: string;
  end_time?: string | null;
  image_url?: string | null;
  category_label: string;
  status: string;
  privacy_level: PrivacyLevel | null;
}

export interface ProfileViewModel {
  profile: UserProfile | null;
  isLoading: boolean;
  isUploadingAvatar: boolean;
  apiError: string | null;
  imageError: string | null;
  imageUploadSuccessMessage: string | null;
  primaryName: string;
  secondaryName: string | null;
  avatarInitial: string;
  overallRatingLabel: string;
  hostRatingLabel: string;
  participantRatingLabel: string;
  hostedEvents: ProfileEventItem[];
  attendedEvents: ProfileEventItem[];
  hostedCount: number;
  attendedCount: number;
  equipment: EquipmentItem[];
  invitations: ReceivedInvitation[];
  invitationCount: number;
  badges: BadgeItem[];
  showcaseImages: ShowcaseImageItem[];
  isActionLoading: boolean;
  isInvitationActionLoading: string | null;
  invitationError: string | null;
  catalogVisible: boolean;
  setCatalogVisible: (visible: boolean) => void;
  pickAvatar: () => Promise<void>;
  refresh: () => Promise<void>;
  handleAcceptInvitation: (invitationId: string) => Promise<void>;
  handleDeclineInvitation: (invitationId: string) => Promise<void>;
  addEquipment: (name: string, description?: string) => Promise<void>;
  editEquipment: (id: string, name: string, description?: string) => Promise<void>;
  removeEquipment: (id: string) => Promise<void>;
  uploadShowcaseImage: () => Promise<void>;
  removeShowcaseImage: (id: string) => Promise<void>;
}

function decodeFileUriOnce(uri: string): string {
  if (!uri.startsWith('file://')) {
    return uri;
  }

  try {
    return `file://${decodeURIComponent(uri.slice('file://'.length))}`;
  } catch {
    return uri;
  }
}

function normalizePickedImageUri(uri: string): string {
  let normalized = uri;

  for (let i = 0; i < 3; i += 1) {
    const next = decodeFileUriOnce(normalized);
    if (next === normalized) break;
    normalized = next;
  }

  return normalized;
}

function getPickedImageUriCandidates(uri: string): string[] {
  return [...new Set([uri, decodeFileUriOnce(uri), normalizePickedImageUri(uri)])];
}

async function preparePickedImageUri(uri: string): Promise<string> {
  let lastError: unknown = null;

  for (const candidateUri of getPickedImageUriCandidates(uri)) {
    try {
      const preparedImage = await ImageManipulator.manipulateAsync(
        candidateUri,
        [],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );
      return preparedImage.uri;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Could not prepare the selected image');
}

async function selectAvatarImage(): Promise<ImagePicker.ImagePickerResult> {
  return ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
}

async function selectGeneralImage(): Promise<ImagePicker.ImagePickerResult> {
  return ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.8,
  });
}

function normalizeEndTime(value?: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Some profile-event endpoints serialize missing end times as Go's zero time.
  if (trimmed.startsWith('0001-01-01')) return null;

  return trimmed;
}

function mapProfileEvent(event: ProfileEventSummary): ProfileEventItem {
  return {
    id: event.id,
    title: event.title,
    start_time: event.start_time,
    end_time: normalizeEndTime(event.end_time),
    image_url: event.image_url ?? null,
    category_label: event.category ?? 'Event',
    status: event.status,
    privacy_level: event.privacy_level ?? null,
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

function normalizeInvitationsResponse(
  response:
    | {
        pending?: ReceivedInvitation[];
        past?: { items?: ReceivedInvitation[] };
        items?: ReceivedInvitation[];
      }
    | null
    | undefined,
): ReceivedInvitation[] {
  if (Array.isArray(response?.pending)) {
    return [...response.pending, ...(response.past?.items ?? [])];
  }
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

function getInvitationErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : i18n.t('profile.invitations.loadFailed');
}

export function useProfileViewModel(): ProfileViewModel {
  const { token } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hostedEvents, setHostedEvents] = useState<ProfileEventItem[]>([]);
  const [attendedEvents, setAttendedEvents] = useState<ProfileEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageUploadSuccessMessage, setImageUploadSuccessMessage] = useState<string | null>(null);
  const imageUploadSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [overallRatingLabel, setOverallRatingLabel] = useState(i18n.t('profile.new'));
  const [hostRatingLabel, setHostRatingLabel] = useState(i18n.t('profile.new'));
  const [participantRatingLabel, setParticipantRatingLabel] = useState(i18n.t('profile.new'));
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [invitations, setInvitations] = useState<ReceivedInvitation[]>([]);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [showcaseImages, setShowcaseImages] = useState<ShowcaseImageItem[]>([]);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isInvitationActionLoading, setIsInvitationActionLoading] = useState<string | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [catalogVisible, setCatalogVisible] = useState(false);

  const fetchProfile = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!token) {
        setProfile(null);
        setHostedEvents([]);
        setAttendedEvents([]);
        setOverallRatingLabel(i18n.t('profile.new'));
        setHostRatingLabel(i18n.t('profile.new'));
        setParticipantRatingLabel(i18n.t('profile.new'));
        setInvitations([]);
        setInvitationError(null);
        setApiError(i18n.t('profile.errors.loginRequired'));
        setIsLoading(false);
        return;
      }

      if (mode === 'initial') setIsLoading(true);
      setApiError(null);
      setInvitationError(null);

      try {
        let nextInvitationError: string | null = null;
        const [
          profileResult,
          hostedResult,
          upcomingResult,
          completedResult,
          canceledResult,
          equipmentResult,
          earnedBadgesResult,
          catalogResult,
          invitationsResult,
        ] = await Promise.all([
          getMyProfile(token),
          getMyHostedEvents(token),
          getMyUpcomingEvents(token),
          getMyCompletedEvents(token),
          getMyCanceledEvents(token),
          getMyEquipment(token),
          getMyBadges(token),
          getBadgeCatalog(token),
          listMyInvitations(token).catch((err) => {
            nextInvitationError = getInvitationErrorMessage(err);
            return null;
          }),
        ]);
        setProfile(profileResult);
        setEquipment(equipmentResult.items);
        setInvitations(normalizeInvitationsResponse(invitationsResult));
        setInvitationError(nextInvitationError);

        // Workaround: Showcase images are currently only returned by the public profile endpoint.
        // We fetch our own public profile to get the showcase images.
        try {
          const publicData = await getPublicProfile(profileResult.id, token);
          setShowcaseImages(publicData?.showcase_images || []);
        } catch (err) {
          console.error('Failed to fetch self public profile for showcase images:', err);
          setShowcaseImages([]);
        }
        
        // Merge earned status
        const mergedBadges = (catalogResult.items || []).map((b: BadgeItem) => {
          const earned = (earnedBadgesResult.items || []).find((eb: BadgeItem) => eb.slug === b.slug);
          return {
            ...b,
            earned: !!earned,
            earned_at: earned?.earned_at || null,
          };
        });
        setBadges(mergedBadges);
        const allHostedEvents = (hostedResult.events || []).map(mapProfileEvent);
        const visibleHostedEvents = allHostedEvents.filter((event: any) =>
          ['IN_PROGRESS', 'COMPLETED', 'CANCELED'].includes(event.status),
        );
        const mergedAttendedEvents = excludeHostedEvents(
          mergeEventsById(
            upcomingResult.events,
            completedResult.events,
            canceledResult.events,
          ),
          allHostedEvents,
        ).filter((event) => shouldShowProfileEvent(event.status));
        setHostedEvents(visibleHostedEvents);
        setAttendedEvents(mergedAttendedEvents);
        const totalCount = (profileResult.host_score?.rating_count || 0) + (profileResult.participant_score?.rating_count || 0);
        setOverallRatingLabel(
          profileResult.final_score != null && totalCount > 0
            ? `${profileResult.final_score.toFixed(1)} (${totalCount})`
            : i18n.t('profile.new'),
        );
        setHostRatingLabel(
          profileResult.host_score?.score != null && profileResult.host_score.rating_count > 0
            ? `${profileResult.host_score.score.toFixed(1)} (${profileResult.host_score.rating_count})`
            : i18n.t('profile.new'),
        );
        setParticipantRatingLabel(
          profileResult.participant_score?.score != null && profileResult.participant_score.rating_count > 0
            ? `${profileResult.participant_score.score.toFixed(1)} (${profileResult.participant_score.rating_count})`
            : i18n.t('profile.new'),
        );
      } catch (err) {
        setHostedEvents([]);
        setAttendedEvents([]);
        setInvitations([]);
        setInvitationError(null);
        setOverallRatingLabel(i18n.t('profile.new'));
        setHostRatingLabel(i18n.t('profile.new'));
        setParticipantRatingLabel(i18n.t('profile.new'));
        if (err instanceof ApiError) {
          setApiError(err.message);
        } else {
          setApiError(i18n.t('profile.errors.loadFailed'));
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

  useEffect(
    () => () => {
      if (imageUploadSuccessTimerRef.current) clearTimeout(imageUploadSuccessTimerRef.current);
    },
    [],
  );

  const refresh = useCallback(async () => {
    await fetchProfile('refresh');
  }, [fetchProfile]);

  const handleAcceptInvitation = useCallback(async (invitationId: string) => {
    if (!token) return;
    setIsInvitationActionLoading(invitationId);
    setInvitationError(null);
    try {
      await acceptInvitation(invitationId, token);
      setInvitations((prev) => prev.filter((invitation) => invitation.invitation_id !== invitationId));
      await refresh();
    } catch (err) {
      setInvitationError(err instanceof ApiError ? err.message : i18n.t('profile.invitations.acceptFailed'));
    } finally {
      setIsInvitationActionLoading(null);
    }
  }, [refresh, token]);

  const handleDeclineInvitation = useCallback(async (invitationId: string) => {
    if (!token) return;
    setIsInvitationActionLoading(invitationId);
    setInvitationError(null);
    try {
      await declineInvitation(invitationId, token);
      setInvitations((prev) => prev.filter((invitation) => invitation.invitation_id !== invitationId));
    } catch (err) {
      setInvitationError(err instanceof ApiError ? err.message : i18n.t('profile.invitations.declineFailed'));
    } finally {
      setIsInvitationActionLoading(null);
    }
  }, [token]);

  const pickAvatar = useCallback(async () => {
    if (!token) {
      setImageError('You must be logged in to update your profile photo.');
      return;
    }

    setImageError(null);
    if (imageUploadSuccessTimerRef.current) {
      clearTimeout(imageUploadSuccessTimerRef.current);
      imageUploadSuccessTimerRef.current = null;
    }
    setImageUploadSuccessMessage(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== 'granted') {
        const message = 'Please allow access to your photo library to add a profile photo.';
        setImageError(message);
        Alert.alert('Permission required', message);
        return;
      }

      const result = await selectAvatarImage();
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.uri) {
        setImageError('We could not read the selected image. Please try a different one.');
        return;
      }

      let preparedImageUri: string;
      try {
        preparedImageUri = await preparePickedImageUri(asset.uri);
      } catch {
        setImageError('We could not process the selected image. Please try a different one.');
        return;
      }

      setIsUploadingAvatar(true);

      const original = await ImageManipulator.manipulateAsync(
        preparedImageUri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );

      const small = await ImageManipulator.manipulateAsync(
        preparedImageUri,
        [{ resize: { width: 400 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );

      const uploadInit = await getProfileAvatarUploadUrl(token);
      const originalUpload = uploadInit.uploads.find((u) => u.variant === 'ORIGINAL');
      const smallUpload = uploadInit.uploads.find((u) => u.variant === 'SMALL');

      if (!originalUpload || !smallUpload) {
        throw new Error('Missing upload instructions from server');
      }

      await Promise.all([
        uploadFileToPresignedUrl(
          originalUpload.method,
          originalUpload.url,
          originalUpload.headers,
          original.uri,
        ),
        uploadFileToPresignedUrl(
          smallUpload.method,
          smallUpload.url,
          smallUpload.headers,
          small.uri,
        ),
      ]);

      await confirmProfileAvatarUpload(uploadInit.confirm_token, token);
      await refresh();
      if (imageUploadSuccessTimerRef.current) clearTimeout(imageUploadSuccessTimerRef.current);
      setImageUploadSuccessMessage('Profile photo updated successfully.');
      imageUploadSuccessTimerRef.current = setTimeout(() => {
        setImageUploadSuccessMessage(null);
        imageUploadSuccessTimerRef.current = null;
      }, 5000);
    } catch (error) {
      if (error instanceof ApiError) {
        setImageError(error.message);
      } else {
        setImageError('We could not upload the selected image. Please try again.');
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  }, [refresh, token]);

  const addEquipment = useCallback(async (name: string, description?: string) => {
    if (!token) return;
    setIsActionLoading(true);
    setApiError(null);
    try {
      await createEquipment({ name, description }, token);
      await refresh();
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : 'Failed to add equipment.');
    } finally {
      setIsActionLoading(false);
    }
  }, [token, refresh]);

  const editEquipment = useCallback(async (id: string, name: string, description?: string) => {
    if (!token) return;
    setIsActionLoading(true);
    setApiError(null);
    try {
      await updateEquipment(id, { name, description }, token);
      await refresh();
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : 'Failed to update equipment.');
    } finally {
      setIsActionLoading(false);
    }
  }, [token, refresh]);

  const removeEquipment = useCallback(async (id: string) => {
    if (!token) return;
    setIsActionLoading(true);
    setApiError(null);
    try {
      await deleteEquipment(id, token);
      await refresh();
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : 'Failed to delete equipment.');
    } finally {
      setIsActionLoading(false);
    }
  }, [token, refresh]);

  const uploadShowcaseImage = useCallback(async () => {
    if (!token) return;
    setIsActionLoading(true);
    setImageError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your photo library.');
        return;
      }

      const result = await selectGeneralImage(); // Allow flexible cropping for showcase
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.uri) return;

      const preparedImageUri = await preparePickedImageUri(asset.uri);
      
      // Showcase images also require both variants (similar to avatar)
      const [original, small] = await Promise.all([
        ImageManipulator.manipulateAsync(
          preparedImageUri,
          [{ resize: { width: 1600 } }], // High quality for showcase
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
        ),
        ImageManipulator.manipulateAsync(
          preparedImageUri,
          [{ resize: { width: 400 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
        ),
      ]);

      const uploadInit = await getShowcaseImageUploadUrl(token);
      const originalUpload = uploadInit.uploads.find((u) => u.variant === 'ORIGINAL');
      const smallUpload = uploadInit.uploads.find((u) => u.variant === 'SMALL');
      
      if (!originalUpload || !smallUpload) throw new Error('Server error');

      await Promise.all([
        uploadFileToPresignedUrl(
          originalUpload.method,
          originalUpload.url,
          originalUpload.headers,
          original.uri,
        ),
        uploadFileToPresignedUrl(
          smallUpload.method,
          smallUpload.url,
          smallUpload.headers,
          small.uri,
        ),
      ]);

      await confirmShowcaseImageUpload(uploadInit.confirm_token, token);
      await refresh();
    } catch (err) {
      setImageError(err instanceof ApiError ? err.message : 'Failed to upload image.');
    } finally {
      setIsActionLoading(false);
    }
  }, [token, refresh]);

  const removeShowcaseImage = useCallback(async (id: string) => {
    if (!token) return;
    setIsActionLoading(true);
    setApiError(null);
    try {
      await deleteShowcaseImage(id, token);
      await refresh();
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : 'Failed to delete image.');
    } finally {
      setIsActionLoading(false);
    }
  }, [token, refresh]);

  const primaryName = profile?.display_name ?? profile?.username ?? '';
  const secondaryName = profile?.display_name ? profile.username : null;
  const avatarInitial = primaryName.trim().charAt(0).toUpperCase() || '?';

  return {
    profile,
    isLoading,
    isUploadingAvatar,
    apiError,
    imageError,
    imageUploadSuccessMessage,
    primaryName,
    secondaryName,
    avatarInitial,
    overallRatingLabel,
    hostRatingLabel,
    participantRatingLabel,
    hostedEvents,
    attendedEvents,
    hostedCount: hostedEvents.length,
    attendedCount: attendedEvents.length,
    equipment,
    invitations,
    invitationCount: invitations.length,
    badges,
    showcaseImages,
    isActionLoading,
    isInvitationActionLoading,
    invitationError,
    catalogVisible,
    setCatalogVisible,
    pickAvatar,
    refresh,
    handleAcceptInvitation,
    handleDeclineInvitation,
    addEquipment,
    editEquipment,
    removeEquipment,
    uploadShowcaseImage,
    removeShowcaseImage,
  };
}
