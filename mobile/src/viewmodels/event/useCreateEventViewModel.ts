import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ApiError } from '@/services/api';
import {
  createEvent,
  createEventInvitations,
  searchLocation,
  getEventImageUploadUrl,
  uploadFileToPresignedUrl,
  confirmEventImageUpload,
} from '@/services/eventService';
import { searchUsers } from '@/services/profileService';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { debounce } from 'lodash';
import {
  PrivacyLevel,
  LocationSuggestion,
  CreateEventRequest,
  CreateEventResponse,
  EventConstraint,
  EventCategory,
} from '@/models/event';

export const CATEGORIES: EventCategory[] = [
  { id: 1, name: 'Sports' },
  { id: 2, name: 'Music' },
  { id: 3, name: 'Education' },
  { id: 4, name: 'Technology' },
  { id: 5, name: 'Art' },
  { id: 6, name: 'Food & Drink' },
  { id: 7, name: 'Outdoors' },
  { id: 8, name: 'Fitness' },
  { id: 9, name: 'Networking' },
  { id: 10, name: 'Gaming' },
  { id: 11, name: 'Charity' },
  { id: 12, name: 'Photography' },
  { id: 13, name: 'Travel' },
  { id: 14, name: 'Workshops' },
  { id: 15, name: 'Conferences' },
  { id: 16, name: 'Movies & Cinema' },
  { id: 17, name: 'Theatre' },
  { id: 18, name: 'Books & Literature' },
  { id: 19, name: 'Wellness' },
  { id: 20, name: 'Volunteering' },
];

export const CATEGORY_PREVIEW_COUNT = 6;

export const PRIVACY_OPTIONS: { label: string; value: PrivacyLevel }[] = [
  { label: 'Public', value: 'PUBLIC' },
  { label: 'Protected', value: 'PROTECTED' },
  { label: 'Private', value: 'PRIVATE' },
];

export const CONSTRAINT_TYPES = ['gender', 'age', 'capacity', 'other'] as const;
export type ConstraintType = (typeof CONSTRAINT_TYPES)[number];

export const MAX_CONSTRAINTS = 5;

export const CONSTRAINT_TYPE_LIMITS: Record<ConstraintType, number> = {
  gender: 1,
  age: 1,
  capacity: 1,
  other: MAX_CONSTRAINTS,
};

export interface CreateEventFormData {
  title: string;
  description: string;
  imageUrl: string;
  categoryId: number | null;
  locationQuery: string;
  address: string;
  lat: number | null;
  lon: number | null;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  privacyLevel: PrivacyLevel;
  tags: string[];
  tagInput: string;
  constraints: EventConstraint[];
  constraintType: ConstraintType;
  // Type-specific constraint inputs
  genderConstraintValue: 'MALE' | 'FEMALE' | null;
  ageMinInput: string;
  ageMaxInput: string;
  capacityInput: string;
  otherConstraintInput: string;
}

export interface CreateEventFormErrors {
  title?: string | null;
  description?: string | null;
  categoryId?: string | null;
  location?: string | null;
  startDate?: string | null;
  startTime?: string | null;
  endDate?: string | null;
  endTime?: string | null;
  tags?: string | null;
  constraints?: string | null;
}

export interface CreateEventViewModel {
  formData: CreateEventFormData;
  errors: CreateEventFormErrors;
  isLoading: boolean;
  isUploadingImage: boolean;
  apiError: string | null;
  imageError: string | null;
  successMessage: string | null;
  imageUploadSuccessMessage: string | null;
  selectedImageUri: string | null;
  locationSuggestions: LocationSuggestion[];
  isSearchingLocation: boolean;
  categoriesExpanded: boolean;
  constraintTypeCounts: Record<ConstraintType, number>;
  updateField: <K extends keyof CreateEventFormData>(
    field: K,
    value: CreateEventFormData[K],
  ) => void;
  handleLocationSearch: (query: string) => void;
  selectLocation: (suggestion: LocationSuggestion) => void;
  clearLocation: () => void;
  toggleCategoriesExpanded: () => void;
  addTag: () => void;
  removeTag: (index: number) => void;
  addGenderConstraint: (gender: 'MALE' | 'FEMALE') => void;
  addConstraint: () => void;
  removeConstraint: (index: number) => void;
  pickImage: () => Promise<void>;
  removeImage: () => void;
  invitedUsers: string[];
  userSearchQuery: string;
  userSuggestions: Array<{ id: string; username: string }>;
  isSearchingUsers: boolean;
  addInvitedUser: (username: string) => void;
  removeInvitedUser: (username: string) => void;
  handleUserSearch: (query: string, token: string) => void;
  pickAndParseUserFile: () => Promise<void>;
  handleSubmit: (token: string) => Promise<CreateEventResponse | null>;
}

export function formatDateForForm(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}.${month}.${year}`;
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

export function normalizePickedImageUri(uri: string): string {
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

export const INITIAL_FORM_DATA: CreateEventFormData = {
  title: '',
  description: '',
  imageUrl: '',
  categoryId: null,
  locationQuery: '',
  address: '',
  lat: null,
  lon: null,
  startDate: formatDateForForm(new Date()),
  startTime: '',
  endDate: '',
  endTime: '',
  privacyLevel: 'PUBLIC',
  tags: [],
  tagInput: '',
  constraints: [],
  constraintType: 'gender',
  genderConstraintValue: null,
  ageMinInput: '',
  ageMaxInput: '',
  capacityInput: '',
  otherConstraintInput: '',
};

export function formatTimeInput(current: string, previous: string): string {
  // Strip non-digit and non-colon characters
  const cleaned = current.replace(/[^\d:]/g, '');
  // If user is deleting, don't auto-format
  if (cleaned.length < previous.length) return cleaned;
  // After typing 2 digits, auto-insert ':'
  if (cleaned.length === 2 && !cleaned.includes(':')) {
    return cleaned + ':';
  }
  // Limit to HH:mm format (5 chars)
  if (cleaned.length > 5) return cleaned.slice(0, 5);
  return cleaned;
}

/** Formats typing into `dd.mm.yyyy` with auto-inserted dots (like `formatTimeInput` for times). */
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

/** Returns an error message if the date string (dd.mm.yyyy) is invalid, or null if valid. */
export function validateDateFormat(date: string): string | null {
  const parts = date.split('.');
  if (parts.length !== 3) return 'Invalid date format';
  const [dayStr, monthStr, yearStr] = parts;
  if (yearStr.length < 4) return 'Invalid date format';
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return 'Invalid date';
  if (month < 1 || month > 12) return 'Invalid date: month must be 1–12';
  if (day < 1 || day > 31) return 'Invalid date: day must be 1–31';
  // Guard against JS Date silently normalizing overflow (e.g. 30.02.2030 → March)
  const iso = `${year}-${monthStr.padStart(2, '0')}-${dayStr.padStart(2, '0')}T00:00:00`;
  const parsed = new Date(iso);
  if (
    isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  ) {
    return 'Invalid date';
  }
  return null;
}

/** Returns an error message if the time string (HH:mm) is invalid, or null if valid. */
export function validateTimeFormat(time: string): string | null {
  const parts = time.split(':');
  if (parts.length !== 2) return 'Invalid time format';
  const [hourStr, minuteStr] = parts;
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  if (isNaN(hour) || isNaN(minute)) return 'Invalid time';
  if (hour < 0 || hour > 23) return 'Invalid time: hour must be 0–23';
  if (minute < 0 || minute > 59) return 'Invalid time: minute must be 0–59';
  return null;
}

function isCompleteDateInput(date: string): boolean {
  return date.length === 10;
}

function isCompleteTimeInput(time: string): boolean {
  return time.length === 5;
}

export function validateLiveDateInput(date: string): string | null {
  if (!date) return null;

  const parts = date.split('.');
  const dayStr = parts[0] ?? '';
  const monthStr = parts[1] ?? '';

  if (dayStr.length === 2) {
    const day = parseInt(dayStr, 10);
    if (isNaN(day) || day < 1 || day > 31) {
      return 'Invalid date: day must be 1-31';
    }
  }

  if (monthStr.length === 2) {
    const month = parseInt(monthStr, 10);
    if (isNaN(month) || month < 1 || month > 12) {
      return 'Invalid date: month must be 1-12';
    }
  }

  if (isCompleteDateInput(date)) {
    return validateDateFormat(date);
  }

  return null;
}

export function validateLiveTimeInput(time: string): string | null {
  if (!time) return null;

  const parts = time.split(':');
  const hourStr = parts[0] ?? '';
  const minuteStr = parts[1] ?? '';

  if (hourStr.length === 2) {
    const hour = parseInt(hourStr, 10);
    if (isNaN(hour) || hour < 0 || hour > 23) {
      return 'Invalid time: hour must be 0-23';
    }
  }

  if (minuteStr.length === 2) {
    const minute = parseInt(minuteStr, 10);
    if (isNaN(minute) || minute < 0 || minute > 59) {
      return 'Invalid time: minute must be 0-59';
    }
  }

  if (isCompleteTimeInput(time)) {
    return validateTimeFormat(time);
  }

  return null;
}

function parseDateTime(date: string, time: string): string | null {
  if (!date || !time) return null;
  const [dayStr, monthStr, yearStr] = date.split('.');
  if (!dayStr || !monthStr || !yearStr) return null;
  const iso = `${yearStr}-${monthStr.padStart(2, '0')}-${dayStr.padStart(2, '0')}T${time}:00`;
  const parsed = new Date(iso);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export const TITLE_MIN_LENGTH = 10;
export const TITLE_MAX_LENGTH = 60;
export const DESCRIPTION_MIN_LENGTH = 20;
export const DESCRIPTION_MAX_LENGTH = 600;
export const CAPACITY_MIN = 2;

function getDateTimeErrors(
  formData: CreateEventFormData,
  requireMissingFields: boolean,
): Pick<CreateEventFormErrors, 'startDate' | 'startTime' | 'endDate' | 'endTime'> {
  const errors: Pick<CreateEventFormErrors, 'startDate' | 'startTime' | 'endDate' | 'endTime'> = {
    startDate: null,
    startTime: null,
    endDate: null,
    endTime: null,
  };

  if (!formData.startDate) {
    if (requireMissingFields) errors.startDate = 'Start date is required';
  } else {
    errors.startDate = validateLiveDateInput(formData.startDate);
  }

  if (!formData.startTime) {
    if (requireMissingFields) errors.startTime = 'Start time is required';
  } else {
    errors.startTime = validateLiveTimeInput(formData.startTime);
  }

  const hasComparableStartDateTime =
    isCompleteDateInput(formData.startDate) &&
    isCompleteTimeInput(formData.startTime) &&
    !errors.startDate &&
    !errors.startTime;

  if (hasComparableStartDateTime) {
    const parsedStart = parseDateTime(formData.startDate, formData.startTime);
    if (!parsedStart) {
      errors.startDate = 'Invalid start date';
    } else if (new Date(parsedStart) <= new Date()) {
      errors.startDate = 'Start date must be in the future';
    }
  }

  const hasEndInput = Boolean(formData.endDate || formData.endTime);
  if (hasEndInput) {
    if (!formData.endDate) {
      if (requireMissingFields) errors.endDate = 'End date is required';
    } else {
      errors.endDate = validateLiveDateInput(formData.endDate);
    }

    if (!formData.endTime) {
      if (requireMissingFields) errors.endTime = 'End time is required';
    } else {
      errors.endTime = validateLiveTimeInput(formData.endTime);
    }

    const hasComparableEndDateTime =
      isCompleteDateInput(formData.endDate) &&
      isCompleteTimeInput(formData.endTime) &&
      !errors.endDate &&
      !errors.endTime;

    if (hasComparableEndDateTime) {
      const parsedEnd = parseDateTime(formData.endDate, formData.endTime);
      const parsedStart = hasComparableStartDateTime
        ? parseDateTime(formData.startDate, formData.startTime)
        : null;

      if (!parsedEnd) {
        errors.endDate = 'Invalid end date';
      } else if (parsedStart && new Date(parsedEnd) <= new Date(parsedStart)) {
        errors.endDate = 'End must be after start';
      }
    }
  }

  return errors;
}

function validateForm(formData: CreateEventFormData): CreateEventFormErrors {
  const errors: CreateEventFormErrors = {};

  const trimmedTitle = formData.title.trim();
  if (!trimmedTitle) {
    errors.title = 'Title is required';
  } else if (trimmedTitle.length < TITLE_MIN_LENGTH) {
    errors.title = `Title must be at least ${TITLE_MIN_LENGTH} characters`;
  } else if (trimmedTitle.length > TITLE_MAX_LENGTH) {
    errors.title = `Title must be at most ${TITLE_MAX_LENGTH} characters`;
  }

  const trimmedDescription = formData.description.trim();
  if (!trimmedDescription) {
    errors.description = 'Description is required';
  } else if (trimmedDescription.length < DESCRIPTION_MIN_LENGTH) {
    errors.description = `Description must be at least ${DESCRIPTION_MIN_LENGTH} characters`;
  } else if (trimmedDescription.length > DESCRIPTION_MAX_LENGTH) {
    errors.description = `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters`;
  }

  if (formData.categoryId === null) {
    errors.categoryId = 'Please select a category';
  }

  if (formData.lat === null || formData.lon === null) {
    errors.location = 'Please select a location';
  }

  Object.assign(errors, getDateTimeErrors(formData, true));

  return errors;
}

function getImageUploadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    if (error.message === 'Network request failed') {
      return 'The event was created, but uploading the image failed because the network request did not complete.';
    }

    if (error.message === 'Missing upload instructions from server') {
      return 'The server returned incomplete image upload instructions.';
    }

    if (error.message.startsWith('Unsupported upload method')) {
      return 'The server returned an unsupported image upload method.';
    }

    if (error.message.startsWith('Upload failed with status')) {
      return 'The event was created, but uploading the image to storage failed.';
    }

    return error.message;
  }

  return 'The event was created, but the image upload failed.';
}

function isLocalDateTimeError(
  field: 'startDate' | 'startTime' | 'endDate' | 'endTime',
  error: string | null | undefined,
): boolean {
  if (error == null) return true;

  const localErrorsByField: Record<
    'startDate' | 'startTime' | 'endDate' | 'endTime',
    Set<string>
  > = {
    startDate: new Set([
      'Start date is required',
      'Invalid date format',
      'Invalid date',
      'Invalid date: day must be 1–31',
      'Invalid date: month must be 1–12',
      'Invalid date: day must be 1-31',
      'Invalid date: month must be 1-12',
      'Start date must be in the future',
      'Invalid start date',
    ]),
    startTime: new Set([
      'Start time is required',
      'Invalid time format',
      'Invalid time',
      'Invalid time: hour must be 0–23',
      'Invalid time: minute must be 0–59',
      'Invalid time: hour must be 0-23',
      'Invalid time: minute must be 0-59',
    ]),
    endDate: new Set([
      'End date is required',
      'Invalid date format',
      'Invalid date',
      'Invalid date: day must be 1–31',
      'Invalid date: month must be 1–12',
      'Invalid date: day must be 1-31',
      'Invalid date: month must be 1-12',
      'End must be after start',
      'Invalid end date',
    ]),
    endTime: new Set([
      'End time is required',
      'Invalid time format',
      'Invalid time',
      'Invalid time: hour must be 0–23',
      'Invalid time: minute must be 0–59',
      'Invalid time: hour must be 0-23',
      'Invalid time: minute must be 0-59',
    ]),
  };

  return localErrorsByField[field].has(error);
}

export function useCreateEventViewModel(): CreateEventViewModel {
  const [formData, setFormData] = useState<CreateEventFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<CreateEventFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [imageUploadSuccessMessage, setImageUploadSuccessMessage] = useState<string | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [invitedUsers, setInvitedUsers] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSuggestions, setUserSuggestions] = useState<Array<{ id: string; username: string }>>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageUploadSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearImageUploadSuccessMessage = useCallback(() => {
    if (imageUploadSuccessTimerRef.current) {
      clearTimeout(imageUploadSuccessTimerRef.current);
      imageUploadSuccessTimerRef.current = null;
    }
    setImageUploadSuccessMessage(null);
  }, []);

  useEffect(
    () => () => {
      if (imageUploadSuccessTimerRef.current) clearTimeout(imageUploadSuccessTimerRef.current);
    },
    [],
  );

  const constraintTypeCounts = useMemo(() => {
    const counts: Record<ConstraintType, number> = { gender: 0, age: 0, capacity: 0, other: 0 };
    formData.constraints.forEach((c) => {
      const t = c.type as ConstraintType;
      if (t in counts) counts[t]++;
    });
    return counts;
  }, [formData.constraints]);

  const updateField = useCallback(
    <K extends keyof CreateEventFormData>(field: K, value: CreateEventFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Map form fields to their corresponding error keys
      const errorKeyMap: Partial<Record<keyof CreateEventFormData, keyof CreateEventFormErrors>> = {
        locationQuery: 'location',
      };
      const errorKey = (errorKeyMap[field] ?? field) as keyof CreateEventFormErrors;
      setErrors((prev) => {
        const next = { ...prev, [errorKey]: null };
        // Time changes also clear the associated date error (cross-field "must be after" constraint)
        if (field === 'startTime') next.startDate = null;
        if (field === 'endTime') next.endDate = null;
        return next;
      });
      setApiError(null);
      setSuccessMessage(null);
      clearImageUploadSuccessMessage();
    },
    [clearImageUploadSuccessMessage],
  );

  const toggleCategoriesExpanded = useCallback(() => {
    setCategoriesExpanded((prev) => !prev);
  }, []);

  useEffect(() => {
    const nextDateTimeErrors = getDateTimeErrors(formData, hasAttemptedSubmit);
    setErrors((prev) => {
      const hasExistingDateTimeError = Boolean(
        prev.startDate || prev.startTime || prev.endDate || prev.endTime,
      );

      if (
        !hasAttemptedSubmit &&
        Object.values(nextDateTimeErrors).every((value) => value == null) &&
        !hasExistingDateTimeError
      ) {
        return prev;
      }

      const dateTimeKeys: Array<keyof typeof nextDateTimeErrors> = [
        'startDate',
        'startTime',
        'endDate',
        'endTime',
      ];
      const changed = dateTimeKeys.some((key) => {
        if (!isLocalDateTimeError(key, prev[key])) {
          return false;
        }

        return prev[key] !== nextDateTimeErrors[key];
      });
      if (!changed) return prev;

      const nextErrors = { ...prev };
      dateTimeKeys.forEach((key) => {
        if (isLocalDateTimeError(key, prev[key])) {
          nextErrors[key] = nextDateTimeErrors[key];
        }
      });

      return nextErrors;
    });
  }, [
    formData.startDate,
    formData.startTime,
    formData.endDate,
    formData.endTime,
    hasAttemptedSubmit,
  ]);

  const handleLocationSearch = useCallback((query: string) => {
    setFormData((prev) => ({ ...prev, locationQuery: query }));
    setErrors((prev) => ({ ...prev, location: null }));

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length < 2) {
      setLocationSuggestions([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingLocation(true);
      const results = await searchLocation(query);
      setLocationSuggestions(results);
      setIsSearchingLocation(false);
    }, 400);
  }, []);

  const selectLocation = useCallback((suggestion: LocationSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      locationQuery: suggestion.display_name,
      address: suggestion.display_name,
      lat: parseFloat(suggestion.lat),
      lon: parseFloat(suggestion.lon),
    }));
    setLocationSuggestions([]);
    setErrors((prev) => ({ ...prev, location: null }));
  }, []);

  const clearLocation = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      locationQuery: '',
      address: '',
      lat: null,
      lon: null,
    }));
    setLocationSuggestions([]);
  }, []);

  const addTag = useCallback(() => {
    setFormData((prev) => {
      const tag = prev.tagInput.trim();
      if (!tag || prev.tags.length >= 5 || prev.tags.includes(tag)) return prev;
      if (tag.length > 20) {
        setErrors((e) => ({ ...e, tags: 'Each tag must be at most 20 characters' }));
        return prev;
      }
      return { ...prev, tags: [...prev.tags, tag], tagInput: '' };
    });
    setErrors((prev) => ({ ...prev, tags: null }));
  }, []);

  const removeTag = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index),
    }));
  }, []);

  const addGenderConstraint = useCallback((gender: 'MALE' | 'FEMALE') => {
    setFormData((prev) => {
      if (prev.constraints.length >= MAX_CONSTRAINTS) return prev;
      const genderCount = prev.constraints.filter((c) => c.type === 'gender').length;
      if (genderCount >= CONSTRAINT_TYPE_LIMITS.gender) return prev;
      const info = gender === 'MALE' ? 'Males only' : 'Females only';
      return {
        ...prev,
        constraints: [...prev.constraints, { type: 'gender', info }],
        genderConstraintValue: null,
      };
    });
    setErrors((prev) => ({ ...prev, constraints: null }));
  }, []);

  const addConstraint = useCallback(() => {
    setFormData((prev) => {
      if (prev.constraints.length >= MAX_CONSTRAINTS) {
        setErrors((e) => ({ ...e, constraints: `Maximum ${MAX_CONSTRAINTS} constraints allowed` }));
        return prev;
      }

      const type = prev.constraintType;
      const typeCounts: Record<ConstraintType, number> = { gender: 0, age: 0, capacity: 0, other: 0 };
      prev.constraints.forEach((c) => {
        const t = c.type as ConstraintType;
        if (t in typeCounts) typeCounts[t]++;
      });

      if (typeCounts[type] >= CONSTRAINT_TYPE_LIMITS[type]) {
        setErrors((e) => ({ ...e, constraints: `Only ${CONSTRAINT_TYPE_LIMITS[type]} ${type} constraint allowed` }));
        return prev;
      }

      let info = '';
      const updates: Partial<CreateEventFormData> = {};

      switch (type) {
        case 'gender': {
          if (!prev.genderConstraintValue) return prev;
          info = prev.genderConstraintValue === 'MALE' ? 'Males only' : 'Females only';
          updates.genderConstraintValue = null;
          break;
        }
        case 'age': {
          const min = prev.ageMinInput.trim();
          const max = prev.ageMaxInput.trim();
          if (!min && !max) return prev;
          if (min) {
            const minNum = parseInt(min, 10);
            if (isNaN(minNum) || minNum < 0 || minNum > 120) {
              setErrors((e) => ({ ...e, constraints: 'Age must be between 0 and 120' }));
              return prev;
            }
          }
          if (max) {
            const maxNum = parseInt(max, 10);
            if (isNaN(maxNum) || maxNum < 0 || maxNum > 120) {
              setErrors((e) => ({ ...e, constraints: 'Age must be between 0 and 120' }));
              return prev;
            }
          }
          if (min && max) {
            const minNum = parseInt(min, 10);
            const maxNum = parseInt(max, 10);
            if (minNum > maxNum) {
              setErrors((e) => ({ ...e, constraints: 'Minimum age cannot be greater than maximum age' }));
              return prev;
            }
            info = `Ages ${minNum}–${maxNum}`;
          } else if (min) {
            info = `${parseInt(min, 10)}+`;
          } else {
            info = `Under ${parseInt(max, 10)}`;
          }
          updates.ageMinInput = '';
          updates.ageMaxInput = '';
          break;
        }
        case 'capacity': {
          const cap = prev.capacityInput.trim();
          if (!cap) return prev;
          const capNum = parseInt(cap, 10);
          if (isNaN(capNum) || capNum < CAPACITY_MIN) {
            setErrors((e) => ({ ...e, constraints: `Capacity must be at least ${CAPACITY_MIN}` }));
            return prev;
          }
          info = `${capNum} participants`;
          updates.capacityInput = '';
          break;
        }
        case 'other': {
          info = prev.otherConstraintInput.trim();
          if (!info) return prev;
          updates.otherConstraintInput = '';
          break;
        }
      }

      setErrors((e) => ({ ...e, constraints: null }));
      const constraint: EventConstraint = { type, info };
      return {
        ...prev,
        ...updates,
        constraints: [...prev.constraints, constraint],
      };
    });
  }, []);

  const removeConstraint = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      constraints: prev.constraints.filter((_, i) => i !== index),
    }));
  }, []);

  const pickImage = useCallback(async () => {
    setImageError(null);

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        const message = 'Please allow access to your photo library to add an event image.';
        setImageError(message);
        Alert.alert('Permission required', message);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
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

      setSuccessMessage(null);
    } catch {
      setImageError('We could not open your photo library. Please try again.');
    }
  }, []);

  const removeImage = useCallback(() => {
    setSelectedImageUri(null);
    setImageError(null);
  }, []);

  const addInvitedUser = useCallback((username: string) => {
    setInvitedUsers((prev) => {
      if (prev.includes(username)) return prev;
      return [...prev, username];
    });
    setUserSearchQuery('');
    setUserSuggestions([]);
  }, []);

  const removeInvitedUser = useCallback((username: string) => {
    setInvitedUsers((prev) => prev.filter((u) => u !== username));
  }, []);

  const handleUserSearch = useCallback((query: string, token: string) => {
    setUserSearchQuery(query);
    if (userSearchTimeoutRef.current) clearTimeout(userSearchTimeoutRef.current);

    if (!query.trim()) {
      setUserSuggestions([]);
      setIsSearchingUsers(false);
      return;
    }

    setIsSearchingUsers(true);
    userSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchUsers(query, token);
        setUserSuggestions(results.items.map((i) => ({ id: i.id, username: i.username })));
      } finally {
        setIsSearchingUsers(false);
      }
    }, 500);
  }, []);

  const pickAndParseUserFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/csv'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const fileUri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri);

      // Split by comma, newline or space and clean up
      const usernames = content
        .split(/[\n,\s]+/)
        .map((u) => u.trim())
        .filter((u) => u.length > 0 && /^[a-zA-Z0-9._]+$/.test(u));

      if (usernames.length === 0) {
        Alert.alert('Invalid File', 'No valid usernames found in the file.');
        return;
      }

      setInvitedUsers((prev) => {
        const combined = [...prev, ...usernames];
        return [...new Set(combined)];
      });

      Alert.alert('Success', `Added ${usernames.length} usernames from file.`);
    } catch (error) {
      console.error('File read error:', error);
      Alert.alert('Error', 'Failed to read the selected file.');
    }
  }, []);

  const uploadEventImage = useCallback(
    async (eventId: string, imageUri: string, token: string): Promise<void> => {
      setIsUploadingImage(true);
      try {
        // Resize to original (max 1200px wide) as JPEG
        const original = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 1200 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
        );

        // Resize to small thumbnail (max 400px wide) as JPEG
        const small = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 400 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
        );

        // 1. Get presigned upload URLs
        const uploadInit = await getEventImageUploadUrl(eventId, token);

        const originalUpload = uploadInit.uploads.find((u) => u.variant === 'ORIGINAL');
        const smallUpload = uploadInit.uploads.find((u) => u.variant === 'SMALL');
        if (!originalUpload || !smallUpload) {
          throw new Error('Missing upload instructions from server');
        }

        // 2. Upload both variants
        await Promise.all([
          uploadFileToPresignedUrl(
            originalUpload.method,
            originalUpload.url,
            originalUpload.headers,
            original.uri,
          ),
          uploadFileToPresignedUrl(smallUpload.method, smallUpload.url, smallUpload.headers, small.uri),
        ]);

        // 3. Confirm
        await confirmEventImageUpload(eventId, uploadInit.confirm_token, token);
      } finally {
        setIsUploadingImage(false);
      }
    },
    [],
  );

  const handleSubmit = useCallback(
    async (token: string): Promise<CreateEventResponse | null> => {
      setHasAttemptedSubmit(true);
      const validationErrors = validateForm(formData);
      const hasErrors = Object.values(validationErrors).some((e) => e != null);
      if (hasErrors) {
        setErrors(validationErrors);
        return null;
      }

      setIsLoading(true);
      setApiError(null);
      setImageError(null);
      setSuccessMessage(null);
      clearImageUploadSuccessMessage();

      try {
        const startTimeISO = parseDateTime(formData.startDate, formData.startTime)!;
        const endTimeISO =
          formData.endDate && formData.endTime
            ? parseDateTime(formData.endDate, formData.endTime) ?? undefined
            : undefined;

        // Map structured constraints to first-class API fields
        let preferredGender: 'MALE' | 'FEMALE' | undefined;
        let minimumAge: number | undefined;
        let capacity: number | undefined;
        const otherConstraints: EventConstraint[] = [];

        for (const c of formData.constraints) {
          switch (c.type) {
            case 'gender':
              preferredGender = c.info === 'Males only' ? 'MALE' : 'FEMALE';
              break;
            case 'age': {
              // Formats: "18+", "Ages 18–30", "Under 30"
              const plusMatch = c.info.match(/^(\d+)\+$/);
              const rangeMatch = c.info.match(/^Ages (\d+)/);
              if (plusMatch) minimumAge = parseInt(plusMatch[1], 10);
              else if (rangeMatch) minimumAge = parseInt(rangeMatch[1], 10);
              break;
            }
            case 'capacity': {
              const capMatch = c.info.match(/(\d+)/);
              if (capMatch) capacity = parseInt(capMatch[1], 10);
              break;
            }
            case 'other':
              otherConstraints.push(c);
              break;
          }
        }

        const address = formData.address || undefined;

        const request: CreateEventRequest = {
          title: formData.title.trim(),
          description: formData.description.trim(),
          image_url: formData.imageUrl.trim() || undefined,
          category_id: formData.categoryId!,
          address,
          lat: formData.lat ?? undefined,
          lon: formData.lon ?? undefined,
          location_type: 'POINT',
          start_time: startTimeISO,
          end_time: endTimeISO,
          privacy_level: formData.privacyLevel,
          tags: formData.tags.length > 0 ? formData.tags : undefined,
          constraints: otherConstraints.length > 0 ? otherConstraints : undefined,
          preferred_gender: preferredGender,
          minimum_age: minimumAge,
          capacity,
        };

        const result = await createEvent(request, token);
        setSuccessMessage('Event created successfully!');

        if (formData.privacyLevel === 'PRIVATE' && invitedUsers.length > 0) {
          try {
            await createEventInvitations(result.id, invitedUsers, token);
          } catch (error) {
            // We don't fail the whole creation for this, but could show a warning
          }
        }

        // Upload image if one was selected
        if (selectedImageUri) {
          try {
            await uploadEventImage(result.id, selectedImageUri, token);
            if (imageUploadSuccessTimerRef.current) clearTimeout(imageUploadSuccessTimerRef.current);
            setImageUploadSuccessMessage('Cover image uploaded successfully.');
            imageUploadSuccessTimerRef.current = setTimeout(() => {
              setImageUploadSuccessMessage(null);
              imageUploadSuccessTimerRef.current = null;
            }, 5000);
          } catch (error) {
            setImageError(getImageUploadErrorMessage(error));
          }
        }

        return result;
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.details) {
            const fieldErrors: CreateEventFormErrors = {};
            for (const [key, msg] of Object.entries(err.details)) {
              if (key === 'title') fieldErrors.title = msg;
              else if (key === 'description') fieldErrors.description = msg;
              else if (key === 'category_id') fieldErrors.categoryId = msg;
              else if (key === 'lat' || key === 'lon' || key === 'address')
                fieldErrors.location = msg;
              else if (key === 'start_time') fieldErrors.startDate = msg;
              else if (key === 'end_time') fieldErrors.endDate = msg;
              else if (key === 'tags') fieldErrors.tags = msg;
              else if (key.startsWith('constraints')) fieldErrors.constraints = msg;
            }
            setErrors(fieldErrors);
          }
          setApiError(err.message);
        } else {
          setApiError('An unexpected error occurred. Please try again.');
        }
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [formData, selectedImageUri, invitedUsers, uploadEventImage, clearImageUploadSuccessMessage],
  );

  return {
    formData,
    errors,
    isLoading,
    isUploadingImage,
    apiError,
    imageError,
    successMessage,
    imageUploadSuccessMessage,
    selectedImageUri,
    locationSuggestions,
    isSearchingLocation,
    categoriesExpanded,
    constraintTypeCounts,
    updateField,
    handleLocationSearch,
    selectLocation,
    clearLocation,
    toggleCategoriesExpanded,
    addTag,
    removeTag,
    addGenderConstraint,
    addConstraint,
    removeConstraint,
    pickImage,
    removeImage,
    invitedUsers,
    userSearchQuery,
    userSuggestions,
    isSearchingUsers,
    addInvitedUser,
    removeInvitedUser,
    handleUserSearch,
    pickAndParseUserFile,
    handleSubmit,
  };
}
