import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/services/api';
import { EventSummary, UserProfile, UpdateProfileRequest } from '../../models/profile';
import { profileService } from '../../services/profileService';
import { prepareAvatarBlobs } from '../../utils/imageResize';
import { searchLocation } from '@/services/eventService';
import type { LocationSuggestion } from '@/models/event';
import { shouldShowProfileEvent } from '@/utils/eventStatus';
import { formatEventLocation } from '@/utils/eventLocation';

const SEARCH_DEBOUNCE_MS = 300;
const MIN_PASSWORD_LENGTH = 8;

type ChangePasswordErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

function getBackendValidationMessage(err: ApiError): string {
  const details = err.details ? Object.values(err.details).filter(Boolean) : [];
  return details.length > 0 ? details.join(' ') : err.message;
}

export function useProfileViewModel(token: string | null) {
  const { setProfileSummary } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hostedEvents, setHostedEvents] = useState<EventSummary[]>([]);
  const [attendedEvents, setAttendedEvents] = useState<EventSummary[]>([]);

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form Draft states
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Default location states
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<{ address: string; lat: number; lon: number } | null>(null);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationCleared, setLocationCleared] = useState(false);
  const locationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Change password states
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<ChangePasswordErrors>({});
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const passwordSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          ? { address: formatEventLocation(data.default_location_address), lat: data.default_location_lat!, lon: data.default_location_lon! }
          : null,
      );
      setLocationQuery('');
      setLocationCleared(false);
      const visibleHosted = hosted.filter((event) => shouldShowProfileEvent(event.status));
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
    } catch (err: unknown) {
      setHostedEvents([]);
      setAttendedEvents([]);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [token, setProfileSummary]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(
    () => () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      if (passwordSuccessTimerRef.current) clearTimeout(passwordSuccessTimerRef.current);
      if (locationTimerRef.current) clearTimeout(locationTimerRef.current);
    },
    [],
  );

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
          ? { address: formatEventLocation(profile.default_location_address), lat: profile.default_location_lat!, lon: profile.default_location_lon! }
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

        for (const instruction of uploadInit.uploads) {
          const blob = instruction.variant === 'ORIGINAL' ? original : small;
          const res = await fetch(instruction.url, {
            method: instruction.method,
            headers: instruction.headers,
            body: blob,
          });
          if (!res.ok) throw new Error(`Image upload failed (${instruction.variant})`);
        }

        await profileService.confirmAvatarUpload(
          { confirm_token: uploadInit.confirm_token },
          token,
        );
      }

      const updatePayload: UpdateProfileRequest = {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      };

      // Include location if changed
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

  return {
    profile,
    hostedEvents,
    attendedEvents,
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
    // Default location
    locationQuery,
    handleLocationSearch,
    locationSuggestions,
    selectedLocation,
    selectLocation,
    clearLocation,
    isSearchingLocation,
    locationCleared,
    // Change password
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
  };
}
