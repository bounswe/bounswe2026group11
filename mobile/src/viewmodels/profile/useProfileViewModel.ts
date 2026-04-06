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
} from '@/services/profileService';
import { ApiError } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { uploadFileToPresignedUrl } from '@/services/eventService';
import { shouldShowProfileEvent } from '@/utils/eventStatus';

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
  ratingLabel: string;
  hostedEvents: ProfileEventItem[];
  attendedEvents: ProfileEventItem[];
  hostedCount: number;
  attendedCount: number;
  pickAvatar: () => Promise<void>;
  refresh: () => Promise<void>;
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
  const [ratingLabel, setRatingLabel] = useState('New');

  const fetchProfile = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!token) {
        setProfile(null);
        setHostedEvents([]);
        setAttendedEvents([]);
        setRatingLabel('New');
        setApiError('You must be logged in to view your profile.');
        setIsLoading(false);
        return;
      }

      if (mode === 'initial') setIsLoading(true);
      setApiError(null);

      try {
        const [
          profileResult,
          hostedResult,
          upcomingResult,
          completedResult,
          canceledResult,
        ] = await Promise.all([
          getMyProfile(token),
          getMyHostedEvents(token),
          getMyUpcomingEvents(token),
          getMyCompletedEvents(token),
          getMyCanceledEvents(token),
        ]);
        setProfile(profileResult);
        const allHostedEvents = hostedResult.events.map(mapProfileEvent);
        const visibleHostedEvents = allHostedEvents.filter((event) =>
          shouldShowProfileEvent(event.status),
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
        setRatingLabel(
          profileResult.host_score?.final_score != null
            ? profileResult.host_score.final_score.toFixed(1)
            : 'New',
        );
      } catch (err) {
        setHostedEvents([]);
        setAttendedEvents([]);
        setRatingLabel('New');
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

  useEffect(
    () => () => {
      if (imageUploadSuccessTimerRef.current) clearTimeout(imageUploadSuccessTimerRef.current);
    },
    [],
  );

  const refresh = useCallback(async () => {
    await fetchProfile('refresh');
  }, [fetchProfile]);

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
    ratingLabel,
    hostedEvents,
    attendedEvents,
    hostedCount: hostedEvents.length,
    attendedCount: attendedEvents.length,
    pickAvatar,
    refresh,
  };
}
