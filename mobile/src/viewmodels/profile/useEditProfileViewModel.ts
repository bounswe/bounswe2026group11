import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { UserProfile, UpdateProfileRequest } from '@/models/profile';
import { LocationSuggestion } from '@/models/event';
import {
  confirmProfileAvatarUpload,
  getMyProfile,
  getProfileAvatarUploadUrl,
  updateMyProfile,
} from '@/services/profileService';
import {
  searchLocation,
  uploadFileToPresignedUrl,
} from '@/services/eventService';
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
  isUploadingAvatar: boolean;
  apiError: string | null;
  imageError: string | null;
  successMessage: string | null;
  canEditGender: boolean;
  canEditBirthDate: boolean;
  locationQuery: string;
  locationSuggestions: LocationSuggestion[];
  isSearchingLocation: boolean;
  selectedImageUri: string | null;
  updateField: <K extends keyof EditProfileFormData>(
    field: K,
    value: EditProfileFormData[K],
  ) => void;
  pickAvatar: () => Promise<void>;
  removeAvatar: () => void;
  updateLocationQuery: (value: string) => void;
  selectLocationSuggestion: (suggestion: LocationSuggestion) => void;
  clearLocation: () => void;
  handleSave: () => Promise<boolean>;
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
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canEditGender, setCanEditGender] = useState(true);
  const [canEditBirthDate, setCanEditBirthDate] = useState(true);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | null>(null);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    },
    [],
  );

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
          setLocationQuery(profile.default_location_address ?? '');
          setSelectedImageUri(profile.avatar_url ?? null);
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
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
      setSuccessMessage(null);
    },
    [],
  );

  const pickAvatar = useCallback(async () => {
    setImageError(null);

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        const message = 'Please allow access to your photo library to add a profile photo.';
        setImageError(message);
        Alert.alert('Permission required', message);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.uri) {
        setImageError('We could not read the selected image. Please try a different one.');
        return;
      }

      try {
        const preparedImageUri = await preparePickedImageUri(asset.uri);
        setSelectedImageUri(preparedImageUri);
      } catch {
        setImageError('We could not process the selected image. Please try a different one.');
        return;
      }

      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
      setSuccessMessage(null);
    } catch {
      setImageError('We could not open your photo library. Please try again.');
    }
  }, []);

  const removeAvatar = useCallback(() => {
    setSelectedImageUri(null);
    setImageError(null);
  }, []);

  const updateLocationQuery = useCallback(async (value: string) => {
    setLocationQuery(value);

    if (value.trim().length < 2) {
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
    setSelectedLocation(suggestion);
    setLocationQuery(suggestion.display_name);
    setFormData((prev) => ({
      ...prev,
      defaultLocationAddress: suggestion.display_name,
      defaultLocationLat: Number(suggestion.lat),
      defaultLocationLon: Number(suggestion.lon),
    }));
    setLocationSuggestions([]);
    setIsSearchingLocation(false);
  }, []);

  const clearLocation = useCallback(() => {
    setSelectedLocation(null);
    setLocationQuery('');
    setLocationSuggestions([]);
    setIsSearchingLocation(false);
    setFormData((prev) => ({
      ...prev,
      defaultLocationAddress: '',
      defaultLocationLat: null,
      defaultLocationLon: null,
    }));
  }, []);

  const uploadProfileAvatar = useCallback(
    async (imageUri: string, token: string): Promise<void> => {
      setIsUploadingAvatar(true);
      try {
        const original = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 1200 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
        );

        const small = await ImageManipulator.manipulateAsync(
          imageUri,
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
      } finally {
        setIsUploadingAvatar(false);
      }
    },
    [],
  );

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
    setImageError(null);
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
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

      const hadNewAvatar = Boolean(selectedImageUri?.startsWith('file://'));
      if (hadNewAvatar) {
        await uploadProfileAvatar(selectedImageUri!, token);
      }

      setSuccessMessage(
        hadNewAvatar ? 'Profile photo updated successfully.' : 'Profile updated successfully!',
      );
      successTimerRef.current = setTimeout(() => {
        setSuccessMessage(null);
        successTimerRef.current = null;
      }, 5000);
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
  }, [canEditBirthDate, canEditGender, formData, selectedImageUri, token, uploadProfileAvatar]);

  return {
    formData,
    errors,
    isLoading,
    isSaving,
    isUploadingAvatar,
    apiError,
    imageError,
    successMessage,
    canEditGender,
    canEditBirthDate,
    locationQuery,
    locationSuggestions,
    isSearchingLocation,
    selectedImageUri,
    updateField,
    pickAvatar,
    removeAvatar,
    updateLocationQuery,
    selectLocationSuggestion,
    clearLocation,
    handleSave,
  };
}
