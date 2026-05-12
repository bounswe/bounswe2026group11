import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/services/api';
import {
  CatalogBadge,
  EarnedBadge,
  EventSummary,
  PublicProfile,
  UpdateProfileRequest,
  UserProfile,
} from '../../models/profile';
import { profileService } from '../../services/profileService';
import { prepareAvatarBlobs } from '../../utils/imageResize';
import { uploadImageVariants } from '@/utils/directImageUpload';
import { searchLocation } from '@/services/eventService';
import type { LocationSuggestion } from '@/models/event';
import { shouldShowProfileEvent } from '@/utils/eventStatus';
import { formatEventLocation } from '@/utils/eventLocation';

const SEARCH_DEBOUNCE_MS = 300;
const MIN_PASSWORD_LENGTH = 8;
const RECENT_EVENT_UPDATE_STORAGE_KEY = 'sem_recent_event_update';

type ChangePasswordErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

type EquipmentDraft = {
  id: string | null;
  name: string;
  description: string;
  imageUrl: string;
};

type RecentEventUpdate = Partial<EventSummary> & {
  eventId?: string;
};

function createEmptyEquipmentDraft(): EquipmentDraft {
  return {
    id: null,
    name: '',
    description: '',
    imageUrl: '',
  };
}

function getBackendValidationMessage(err: ApiError): string {
  const details = err.details ? Object.values(err.details).filter(Boolean) : [];
  return details.length > 0 ? details.join(' ') : err.message;
}

function readRecentEventUpdate(): RecentEventUpdate | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(RECENT_EVENT_UPDATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecentEventUpdate;
    return typeof parsed.eventId === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function applyRecentEventUpdate(events: EventSummary[], recent: RecentEventUpdate | null): EventSummary[] {
  if (!recent?.eventId) return events;
  return events.map((event) => {
    if (event.id !== recent.eventId) return event;
    return {
      ...event,
      ...recent,
      id: event.id,
      category: event.category,
      category_name: recent.category_name ?? event.category_name,
    };
  });
}

export function useProfileViewModel(token: string | null) {
  const { setProfileSummary } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [hostedEvents, setHostedEvents] = useState<EventSummary[]>([]);
  const [attendedEvents, setAttendedEvents] = useState<EventSummary[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [badgeCatalog, setBadgeCatalog] = useState<CatalogBadge[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [publicProfileLoading, setPublicProfileLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicProfileError, setPublicProfileError] = useState<string | null>(null);
  const [badgeError, setBadgeError] = useState<string | null>(null);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<{ address: string; lat: number; lon: number } | null>(null);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationCleared, setLocationCleared] = useState(false);
  const locationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<ChangePasswordErrors>({});
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const passwordSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isEquipmentEditorOpen, setIsEquipmentEditorOpen] = useState(false);
  const [equipmentDraft, setEquipmentDraft] = useState<EquipmentDraft>(createEmptyEquipmentDraft());
  const [equipmentSubmitting, setEquipmentSubmitting] = useState(false);
  const [equipmentDeletingId, setEquipmentDeletingId] = useState<string | null>(null);
  const [equipmentError, setEquipmentError] = useState<string | null>(null);

  const [showcaseUploading, setShowcaseUploading] = useState(false);
  const [showcaseRemovingId, setShowcaseRemovingId] = useState<string | null>(null);
  const [showcaseError, setShowcaseError] = useState<string | null>(null);

  const fetchPublicProfile = useCallback(async (userId: string) => {
    setPublicProfileLoading(true);
    setPublicProfileError(null);
    try {
      const data = await profileService.getPublicProfile(userId);
      setPublicProfile(data);
    } catch (err: unknown) {
      setPublicProfile(null);
      setPublicProfileError(err instanceof Error ? err.message : 'Failed to load public profile sections.');
    } finally {
      setPublicProfileLoading(false);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const [data, hosted, upcoming, completed, canceled] = await Promise.all([
        profileService.getMyProfile(token),
        profileService.getHostedEvents(token),
        profileService.getUpcomingEvents(token),
        profileService.getCompletedEvents(token),
        profileService.getCanceledEvents(token),
      ]);
      setProfile(data);
      setDisplayName(data.display_name || '');
      setBio(data.bio || '');
      setSelectedLocation(
        data.default_location_address
          ? {
              address: formatEventLocation(data.default_location_address),
              lat: data.default_location_lat!,
              lon: data.default_location_lon!,
            }
          : null,
      );
      setLocationQuery('');
      setLocationCleared(false);
      const recentUpdate = readRecentEventUpdate();
      const visibleHosted = applyRecentEventUpdate(
        hosted.filter((event) => shouldShowProfileEvent(event.status)),
        recentUpdate,
      );
      const hostedIds = new Set(hosted.map((event) => event.id));
      const mergedAttended = [...upcoming, ...completed, ...canceled]
        .filter((event, index, arr) => arr.findIndex((candidate) => candidate.id === event.id) === index)
        .filter((event) => !hostedIds.has(event.id))
        .filter((event) => shouldShowProfileEvent(event.status));
      setHostedEvents(visibleHosted);
      setAttendedEvents(mergedAttended);
      setProfileSummary({
        avatarUrl: data.avatar_url ?? null,
        displayName: data.display_name ?? null,
      });
      void fetchPublicProfile(data.id);
    } catch (err: unknown) {
      setHostedEvents([]);
      setAttendedEvents([]);
      setPublicProfile(null);
      setPublicProfileLoading(false);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [fetchPublicProfile, token, setProfileSummary]);

  const fetchBadges = useCallback(async () => {
    if (!token) return;
    setBadgesLoading(true);
    setBadgeError(null);
    try {
      const [earned, catalog] = await Promise.all([
        profileService.getMyBadges(token),
        profileService.getBadgeCatalog(token),
      ]);
      setEarnedBadges(earned.items ?? []);
      setBadgeCatalog(catalog.items ?? []);
    } catch (err: unknown) {
      setEarnedBadges([]);
      setBadgeCatalog([]);
      setBadgeError(err instanceof Error ? err.message : 'Failed to load badges');
    } finally {
      setBadgesLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchProfile();
    void fetchBadges();
  }, [fetchBadges, fetchProfile]);

  useEffect(() => {
    const refreshAfterEventUpdate = () => {
      void fetchProfile();
    };
    window.addEventListener('sem:event-updated', refreshAfterEventUpdate);
    return () => window.removeEventListener('sem:event-updated', refreshAfterEventUpdate);
  }, [fetchProfile]);

  useEffect(
    () => () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      if (passwordSuccessTimerRef.current) clearTimeout(passwordSuccessTimerRef.current);
      if (locationTimerRef.current) clearTimeout(locationTimerRef.current);
    },
    [],
  );

  const refreshPublicProfile = useCallback(async () => {
    if (!profile?.id) return;
    await fetchPublicProfile(profile.id);
  }, [fetchPublicProfile, profile?.id]);

  const handleLocationSearch = useCallback((query: string) => {
    setLocationQuery(query);
    if (locationTimerRef.current) clearTimeout(locationTimerRef.current);

    if (query.trim().length < 2) {
      setLocationSuggestions([]);
      return;
    }

    locationTimerRef.current = setTimeout(async () => {
      setIsSearchingLocation(true);
      try {
        const results = await searchLocation(query);
        setLocationSuggestions(results);
      } catch {
        setLocationSuggestions([]);
      } finally {
        setIsSearchingLocation(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const selectLocation = useCallback((suggestion: LocationSuggestion) => {
    setSelectedLocation({
      address: formatEventLocation(suggestion.display_name),
      lat: parseFloat(suggestion.lat),
      lon: parseFloat(suggestion.lon),
    });
    setLocationQuery(formatEventLocation(suggestion.display_name));
    setLocationSuggestions([]);
    setLocationCleared(false);
  }, []);

  const clearLocation = useCallback(() => {
    setSelectedLocation(null);
    setLocationQuery('');
    setLocationSuggestions([]);
    setLocationCleared(true);
  }, []);

  const handleFileChange = useCallback((file: File | null) => {
    setAvatarFile(file);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(file ? URL.createObjectURL(file) : null);
  }, [avatarPreview]);

  const handleEditToggle = () => {
    if (isEditing) {
      setDisplayName(profile?.display_name || '');
      setBio(profile?.bio || '');
      setAvatarFile(null);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
      setSelectedLocation(
        profile?.default_location_address
          ? {
              address: formatEventLocation(profile.default_location_address),
              lat: profile.default_location_lat!,
              lon: profile.default_location_lon!,
            }
          : null,
      );
      setLocationQuery('');
      setLocationSuggestions([]);
      setLocationCleared(false);
      setError(null);
      setSuccess(null);
    }
    setIsEditing(!isEditing);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      if (!token) throw new Error('Authentication token is missing.');

      const hadAvatarUpload = !!avatarFile;

      if (avatarFile) {
        const { original, small } = await prepareAvatarBlobs(avatarFile);
        const uploadInit = await profileService.getAvatarUploadUrl(token);
        await uploadImageVariants(uploadInit, { original, small });

        await profileService.confirmAvatarUpload(
          { confirm_token: uploadInit.confirm_token },
          token,
        );
      }

      const updatePayload: UpdateProfileRequest = {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      };

      if (locationCleared) {
        updatePayload.default_location_address = null;
        updatePayload.default_location_lat = null;
        updatePayload.default_location_lon = null;
      } else if (selectedLocation && selectedLocation.address !== profile?.default_location_address) {
        updatePayload.default_location_address = selectedLocation.address;
        updatePayload.default_location_lat = selectedLocation.lat;
        updatePayload.default_location_lon = selectedLocation.lon;
      }

      await profileService.updateMyProfile(updatePayload, token);
      await fetchProfile();

      setAvatarFile(null);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
      setIsEditing(false);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      const message = hadAvatarUpload
        ? 'Profile photo updated successfully!'
        : 'Profile updated successfully!';
      setSuccess(message);
      successTimerRef.current = setTimeout(() => {
        setSuccess(null);
        successTimerRef.current = null;
      }, 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const resetPasswordForm = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordErrors({});
    setPasswordError(null);
  }, []);

  const togglePasswordForm = useCallback(() => {
    setIsPasswordFormOpen((open) => {
      if (open) resetPasswordForm();
      setPasswordSuccess(null);
      return !open;
    });
  }, [resetPasswordForm]);

  const validateChangePassword = useCallback((): boolean => {
    const nextErrors: ChangePasswordErrors = {};

    if (!currentPassword) {
      nextErrors.currentPassword = 'Current password is required.';
    }

    if (!newPassword) {
      nextErrors.newPassword = 'New password is required.';
    } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
      nextErrors.newPassword = `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Confirm new password is required.';
    } else if (newPassword && newPassword !== confirmPassword) {
      nextErrors.confirmPassword = 'New password and confirmation must match.';
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      nextErrors.newPassword = 'New password must differ from current password.';
    }

    setPasswordErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [confirmPassword, currentPassword, newPassword]);

  const handleChangePassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!validateChangePassword()) return;

    if (!token) {
      setPasswordError('Authentication token is missing.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await profileService.changePassword({
        old_password: currentPassword,
        new_password: newPassword,
      }, token);

      resetPasswordForm();
      setIsPasswordFormOpen(false);
      setPasswordSuccess('Password changed successfully.');
      if (passwordSuccessTimerRef.current) clearTimeout(passwordSuccessTimerRef.current);
      passwordSuccessTimerRef.current = setTimeout(() => {
        setPasswordSuccess(null);
        passwordSuccessTimerRef.current = null;
      }, 5000);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 401 || err.status === 403) {
          setPasswordError('Current password is incorrect');
        } else if (err.status === 400) {
          setPasswordError(getBackendValidationMessage(err));
        } else {
          setPasswordError(err.message);
        }
      } else {
        setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
      }
    } finally {
      setIsChangingPassword(false);
    }
  }, [currentPassword, newPassword, resetPasswordForm, token, validateChangePassword]);

  const updateEquipmentDraft = useCallback((field: 'name' | 'description' | 'imageUrl', value: string) => {
    setEquipmentDraft((current) => ({ ...current, [field]: value }));
  }, []);

  const startCreatingEquipment = useCallback(() => {
    setEquipmentDraft(createEmptyEquipmentDraft());
    setEquipmentError(null);
    setIsEquipmentEditorOpen(true);
  }, []);

  const startEditingEquipment = useCallback((item: NonNullable<PublicProfile['equipment']>[number]) => {
    setEquipmentDraft({
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      imageUrl: item.image_url ?? '',
    });
    setEquipmentError(null);
    setIsEquipmentEditorOpen(true);
  }, []);

  const cancelEquipmentEditor = useCallback(() => {
    setEquipmentDraft(createEmptyEquipmentDraft());
    setEquipmentError(null);
    setIsEquipmentEditorOpen(false);
  }, []);

  const handleEquipmentSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setEquipmentError(null);

    if (!token) {
      setEquipmentError('Authentication token is missing.');
      return;
    }

    const trimmedName = equipmentDraft.name.trim();
    if (!trimmedName) {
      setEquipmentError('Equipment name is required.');
      return;
    }

    setEquipmentSubmitting(true);
    try {
      const payload = {
        name: trimmedName,
        description: equipmentDraft.description.trim() || null,
        image_url: equipmentDraft.imageUrl.trim() || null,
      };

      if (equipmentDraft.id) {
        await profileService.updateEquipment(equipmentDraft.id, payload, token);
      } else {
        await profileService.createEquipment(payload, token);
      }

      await refreshPublicProfile();
      cancelEquipmentEditor();
    } catch (err: unknown) {
      setEquipmentError(err instanceof Error ? err.message : 'Failed to save equipment.');
    } finally {
      setEquipmentSubmitting(false);
    }
  }, [cancelEquipmentEditor, equipmentDraft, refreshPublicProfile, token]);

  const handleDeleteEquipment = useCallback(async (equipmentId: string) => {
    if (!token) {
      setEquipmentError('Authentication token is missing.');
      return;
    }

    setEquipmentDeletingId(equipmentId);
    setEquipmentError(null);

    try {
      await profileService.deleteEquipment(equipmentId, token);
      await refreshPublicProfile();
      if (equipmentDraft.id === equipmentId) {
        cancelEquipmentEditor();
      }
    } catch (err: unknown) {
      setEquipmentError(err instanceof Error ? err.message : 'Failed to delete equipment.');
    } finally {
      setEquipmentDeletingId(null);
    }
  }, [cancelEquipmentEditor, equipmentDraft.id, refreshPublicProfile, token]);

  const handleShowcaseUpload = useCallback(async (file: File) => {
    if (!token) {
      setShowcaseError('Authentication token is missing.');
      return;
    }

    setShowcaseUploading(true);
    setShowcaseError(null);

    try {
      const { original, small } = await prepareAvatarBlobs(file);
      const uploadInit = await profileService.getShowcaseUploadUrl(token);
      await uploadImageVariants(uploadInit, { original, small });

      await profileService.confirmShowcaseUpload({ confirm_token: uploadInit.confirm_token }, token);
      await refreshPublicProfile();
    } catch (err: unknown) {
      setShowcaseError(err instanceof Error ? err.message : 'Failed to upload showcase image.');
    } finally {
      setShowcaseUploading(false);
    }
  }, [refreshPublicProfile, token]);

  const handleDeleteShowcaseImage = useCallback(async (showcaseImageId: string) => {
    if (!token) {
      setShowcaseError('Authentication token is missing.');
      return;
    }

    setShowcaseRemovingId(showcaseImageId);
    setShowcaseError(null);

    try {
      await profileService.deleteShowcaseImage(showcaseImageId, token);
      await refreshPublicProfile();
    } catch (err: unknown) {
      setShowcaseError(err instanceof Error ? err.message : 'Failed to remove showcase image.');
    } finally {
      setShowcaseRemovingId(null);
    }
  }, [refreshPublicProfile, token]);

  return {
    profile,
    publicProfile,
    publicProfileLoading,
    publicProfileError,
    refreshPublicProfile,
    hostedEvents,
    attendedEvents,
    earnedBadges,
    badgeCatalog,
    badgesLoading,
    badgeError,
    refreshBadges: fetchBadges,
    isLoading,
    isEditing,
    isSaving,
    error,
    success,
    displayName,
    setDisplayName,
    bio,
    setBio,
    avatarPreview,
    handleFileChange,
    handleEditToggle,
    handleSave,
    locationQuery,
    handleLocationSearch,
    locationSuggestions,
    selectedLocation,
    selectLocation,
    clearLocation,
    isSearchingLocation,
    locationCleared,
    isPasswordFormOpen,
    togglePasswordForm,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    passwordErrors,
    passwordError,
    passwordSuccess,
    isChangingPassword,
    handleChangePassword,
    isEquipmentEditorOpen,
    equipmentDraft,
    updateEquipmentDraft,
    equipmentSubmitting,
    equipmentDeletingId,
    equipmentError,
    startCreatingEquipment,
    startEditingEquipment,
    cancelEquipmentEditor,
    handleEquipmentSubmit,
    handleDeleteEquipment,
    showcaseUploading,
    showcaseRemovingId,
    showcaseError,
    handleShowcaseUpload,
    handleDeleteShowcaseImage,
  };
}
