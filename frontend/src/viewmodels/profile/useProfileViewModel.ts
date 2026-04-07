import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { EventSummary, UserProfile, UpdateProfileRequest } from '../../models/profile';
import { profileService } from '../../services/profileService';
import { prepareAvatarBlobs } from '../../utils/imageResize';
import { searchLocation } from '@/services/eventService';
import type { LocationSuggestion } from '@/models/event';
import { shouldShowProfileEvent } from '@/utils/eventStatus';
import { formatEventLocation } from '@/utils/eventLocation';

const SEARCH_DEBOUNCE_MS = 300;

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
  };
}
