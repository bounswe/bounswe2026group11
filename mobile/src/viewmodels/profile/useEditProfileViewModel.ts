import { useState, useCallback, useEffect } from 'react';
import { UserProfile, UpdateProfileRequest } from '@/models/profile';
import { LocationSuggestion } from '@/models/event';
import { getMyProfile, updateMyProfile } from '@/services/profileService';
import { searchLocation } from '@/services/eventService';
import { ApiError } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { validatePhoneNumber } from '@/utils/validators';

export const GENDER_OPTIONS: { label: string; value: string }[] = [
  { label: 'Male', value: 'MALE' },
  { label: 'Female', value: 'FEMALE' },
  { label: 'Other', value: 'OTHER' },
  { label: 'Prefer not to say', value: 'PREFER_NOT_TO_SAY' },
];

export const DISPLAY_NAME_MAX_LENGTH = 64;
export const BIO_MAX_LENGTH = 512;
export const PHONE_MAX_LENGTH = 32;

export interface EditProfileFormData {
  displayName: string;
  bio: string;
  phoneNumber: string;
  gender: string;
  birthDate: string;
  defaultLocationAddress: string;
  defaultLocationLat: number | null;
  defaultLocationLon: number | null;
}

export interface EditProfileFormErrors {
  displayName?: string | null;
  bio?: string | null;
  phoneNumber?: string | null;
  birthDate?: string | null;
}

export interface EditProfileViewModel {
  formData: EditProfileFormData;
  errors: EditProfileFormErrors;
  isLoading: boolean;
  isSaving: boolean;
  apiError: string | null;
  successMessage: string | null;
  canEditGender: boolean;
  canEditBirthDate: boolean;
  locationQuery: string;
  locationSuggestions: LocationSuggestion[];
  isSearchingLocation: boolean;
  isLocationModalOpen: boolean;
  pendingLocation: LocationSuggestion | null;
  updateField: <K extends keyof EditProfileFormData>(
    field: K,
    value: EditProfileFormData[K],
  ) => void;
  openLocationModal: () => void;
  closeLocationModal: () => void;
  updateLocationQuery: (value: string) => void;
  selectLocationSuggestion: (suggestion: LocationSuggestion) => void;
  applySelectedLocation: () => void;
  resetLocationDraft: () => void;
  handleSave: () => Promise<boolean>;
}

/** Formats typing into `dd.mm.yyyy` with auto-inserted dots. */
function formatDigitsToDate(digits: string): string {
  if (digits.length === 0) return '';
  const day = digits.slice(0, 2);
  if (digits.length <= 2) return day;
  const month = digits.slice(2, 4);
  if (digits.length <= 4) return `${day}.${month}`;
  const year = digits.slice(4, 8);
  return `${day}.${month}.${year}`;
}

export function formatDateInput(current: string, previous: string): string {
  const digits = current.replace(/\D/g, '');
  const prevDigits = previous.replace(/\D/g, '');
  if (digits.length < prevDigits.length) {
    return formatDigitsToDate(digits);
  }
  return formatDigitsToDate(digits.slice(0, 8));
}

function toUIFormat(date: string | null | undefined): string {
  if (!date || !date.includes('-')) return date ?? '';
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y}`;
}

function toBackendFormat(date: string | null | undefined): string | null {
  if (!date || !date.includes('.')) return null;
  const [d, m, y] = date.split('.');
  return `${y}-${m}-${d}`;
}

function profileToFormData(profile: UserProfile): EditProfileFormData {
  return {
    displayName: profile.display_name ?? '',
    bio: profile.bio ?? '',
    phoneNumber: profile.phone_number ?? '',
    gender: profile.gender ?? '',
    birthDate: toUIFormat(profile.birth_date),
    defaultLocationAddress: profile.default_location_address ?? '',
    defaultLocationLat: profile.default_location_lat ?? null,
    defaultLocationLon: profile.default_location_lon ?? null,
  };
}

function profileToLocationSuggestion(profile: UserProfile): LocationSuggestion | null {
  if (
    !profile.default_location_address ||
    profile.default_location_lat == null ||
    profile.default_location_lon == null
  ) {
    return null;
  }

  return {
    display_name: profile.default_location_address,
    lat: String(profile.default_location_lat),
    lon: String(profile.default_location_lon),
  };
}

function validateBirthDate(date: string): string | null {
  if (!date) return null;
  const match = date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return 'Use dd.mm.yyyy format';
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  if (month < 1 || month > 12) return 'Month must be between 01 and 12.';
  if (day < 1 || day > 31) return 'Day must be between 01 and 31.';

  const parsed = new Date(year, month - 1, day);
  if (
    isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  ) {
    return 'Please give a valid birth date';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsed > today) {
    return 'Birth date cannot be in the future';
  }
  return null;
}

function validateForm(formData: EditProfileFormData): EditProfileFormErrors {
  const errors: EditProfileFormErrors = {};

  if (formData.displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    errors.displayName = `Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`;
  }

  if (formData.bio.length > BIO_MAX_LENGTH) {
    errors.bio = `Bio must be at most ${BIO_MAX_LENGTH} characters`;
  }

  if (formData.phoneNumber.length > PHONE_MAX_LENGTH) {
    errors.phoneNumber = `Phone number must be at most ${PHONE_MAX_LENGTH} characters`;
  }

  if (formData.birthDate) {
    const dateError = validateBirthDate(formData.birthDate);
    if (dateError) errors.birthDate = dateError;
  }

  return errors;
}

export function useEditProfileViewModel(): EditProfileViewModel {
  const { token } = useAuth();

  const [formData, setFormData] = useState<EditProfileFormData>({
    displayName: '',
    bio: '',
    phoneNumber: '',
    gender: '',
    birthDate: '',
    defaultLocationAddress: '',
    defaultLocationLat: null,
    defaultLocationLon: null,
  });
  const [errors, setErrors] = useState<EditProfileFormErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [canEditGender, setCanEditGender] = useState(true);
  const [canEditBirthDate, setCanEditBirthDate] = useState(true);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | null>(null);
  const [pendingLocation, setPendingLocation] = useState<LocationSuggestion | null>(null);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      setApiError('You must be logged in to edit your profile.');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const profile = await getMyProfile(token);
        if (!cancelled) {
          setFormData(profileToFormData(profile));
          setCanEditGender(!profile.gender);
          setCanEditBirthDate(!profile.birth_date);
          setSelectedLocation(profileToLocationSuggestion(profile));
        }
      } catch (err) {
        if (!cancelled) {
          setApiError(
            err instanceof ApiError
              ? err.message
              : 'Failed to load profile. Please try again.',
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const updateField = useCallback(
    <K extends keyof EditProfileFormData>(
      field: K,
      value: EditProfileFormData[K],
    ) => {
      let immediateError: string | null = null;
      
      setFormData((prev) => {
        let finalValue = value;
        if (field === 'birthDate') {
          finalValue = formatDateInput(value as string, prev.birthDate) as any;
          
          const digits = (finalValue as string).replace(/\D/g, '');
          // Immediate numeric boundary checks
          if (digits.length >= 2) {
            const day = parseInt(digits.slice(0, 2), 10);
            if (day > 31) immediateError = 'Day must be between 01 and 31.';
          }
          if (digits.length >= 4 && !immediateError) {
            const month = parseInt(digits.slice(2, 4), 10);
            if (month > 12) immediateError = 'Month must be between 01 and 12.';
          }
          // Full validation once complete
          if (digits.length === 8 && !immediateError) {
            immediateError = validateBirthDate(finalValue as string);
          }
        } else if (field === 'phoneNumber') {
          finalValue = value as any;
          immediateError = validatePhoneNumber(value as string);
        }
        return { ...prev, [field]: finalValue };
      });

      setErrors((prev) => ({ ...prev, [field]: immediateError }));
      setApiError(null);
      setSuccessMessage(null);
    },
    [],
  );

  const openLocationModal = useCallback(() => {
    setPendingLocation(selectedLocation);
    setLocationQuery(selectedLocation?.display_name ?? '');
    setLocationSuggestions([]);
    setIsSearchingLocation(false);
    setIsLocationModalOpen(true);
  }, [selectedLocation]);

  const closeLocationModal = useCallback(() => {
    setPendingLocation(null);
    setLocationQuery('');
    setLocationSuggestions([]);
    setIsSearchingLocation(false);
    setIsLocationModalOpen(false);
  }, []);

  const updateLocationQuery = useCallback(async (value: string) => {
    setLocationQuery(value);

    if (value.trim().length < 2) {
      setPendingLocation(null);
      setLocationSuggestions([]);
      setIsSearchingLocation(false);
      return;
    }

    setIsSearchingLocation(true);
    try {
      const results = await searchLocation(value);
      setLocationSuggestions(results);
    } finally {
      setIsSearchingLocation(false);
    }
  }, []);

  const selectLocationSuggestion = useCallback((suggestion: LocationSuggestion) => {
    setPendingLocation(suggestion);
    setLocationQuery(suggestion.display_name);
    setLocationSuggestions([]);
  }, []);

  const applySelectedLocation = useCallback(() => {
    setSelectedLocation(pendingLocation ?? null);
    setFormData((prev) => ({
      ...prev,
      defaultLocationAddress: pendingLocation?.display_name ?? '',
      defaultLocationLat: pendingLocation ? Number(pendingLocation.lat) : null,
      defaultLocationLon: pendingLocation ? Number(pendingLocation.lon) : null,
    }));
    setLocationSuggestions([]);
    setLocationQuery('');
    setIsLocationModalOpen(false);
  }, [pendingLocation]);

  const resetLocationDraft = useCallback(() => {
    setPendingLocation(null);
    setLocationQuery('');
    setLocationSuggestions([]);
    setIsSearchingLocation(false);
  }, []);

  const handleSave = useCallback(async (): Promise<boolean> => {
    const validationErrors = validateForm(formData);
    const hasErrors = Object.values(validationErrors).some((e) => e != null);
    if (hasErrors) {
      setErrors(validationErrors);
      return false;
    }

    if (!token) {
      setApiError('You must be logged in to save changes.');
      return false;
    }

    setIsSaving(true);
    setApiError(null);
    setSuccessMessage(null);

    try {
      const request: UpdateProfileRequest = {
        display_name: formData.displayName.trim() || '',
        bio: formData.bio.trim() || '',
        phone_number: formData.phoneNumber.trim() || '',
        default_location_address: formData.defaultLocationAddress || null,
        default_location_lat: formData.defaultLocationLat,
        default_location_lon: formData.defaultLocationLon,
      };

      if (canEditGender) {
        request.gender = formData.gender || null;
      }

      if (canEditBirthDate) {
        request.birth_date = toBackendFormat(formData.birthDate);
      }

      await updateMyProfile(request, token);
      setSuccessMessage('Profile updated successfully!');
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details) {
          const fieldErrors: EditProfileFormErrors = {};
          for (const [key, msg] of Object.entries(err.details)) {
            if (key === 'display_name') fieldErrors.displayName = msg;
            else if (key === 'bio') fieldErrors.bio = msg;
            else if (key === 'phone_number') fieldErrors.phoneNumber = msg;
            else if (key === 'birth_date') fieldErrors.birthDate = msg;
          }
          setErrors(fieldErrors);
        }
        setApiError(err.message);
      } else {
        setApiError('An unexpected error occurred. Please try again.');
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [canEditBirthDate, canEditGender, formData, token]);

  return {
    formData,
    errors,
    isLoading,
    isSaving,
    apiError,
    successMessage,
    canEditGender,
    canEditBirthDate,
    locationQuery,
    locationSuggestions,
    isSearchingLocation,
    isLocationModalOpen,
    pendingLocation,
    updateField,
    openLocationModal,
    closeLocationModal,
    updateLocationQuery,
    selectLocationSuggestion,
    applySelectedLocation,
    resetLocationDraft,
    handleSave,
  };
}
