import { useState, useCallback, useRef, useMemo } from 'react';
import { ApiError } from '@/services/api';
import { createEvent, searchLocation } from '@/services/eventService';
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

export const CONSTRAINT_TYPE_LIMITS: Record<ConstraintType, number> = {
  gender: 1,
  age: 1,
  capacity: 1,
  other: 2,
};

export interface CreateEventFormData {
  title: string;
  description: string;
  imageUrl: string;
  categoryId: number | null;
  locationQuery: string;
  locationDescription: string;
  address: string;
  lat: number | null;
  lon: number | null;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  privacyLevel: PrivacyLevel;
  invitedUsernames: string[];
  inviteUsernameInput: string;
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
  startDateTime?: string | null;
  endDateTime?: string | null;
  tags?: string | null;
  constraints?: string | null;
}

export interface CreateEventViewModel {
  formData: CreateEventFormData;
  errors: CreateEventFormErrors;
  isLoading: boolean;
  apiError: string | null;
  successMessage: string | null;
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
  addInvitedUsername: () => void;
  removeInvitedUsername: (index: number) => void;
  addTag: () => void;
  removeTag: (index: number) => void;
  addGenderConstraint: (gender: 'MALE' | 'FEMALE') => void;
  addConstraint: () => void;
  removeConstraint: (index: number) => void;
  handleSubmit: (token: string) => Promise<CreateEventResponse | null>;
}

const INITIAL_FORM_DATA: CreateEventFormData = {
  title: '',
  description: '',
  imageUrl: '',
  categoryId: null,
  locationQuery: '',
  locationDescription: '',
  address: '',
  lat: null,
  lon: null,
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  privacyLevel: 'PUBLIC',
  invitedUsernames: [],
  inviteUsernameInput: '',
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

function parseDateTime(date: string, time: string): string | null {
  if (!date || !time) return null;
  const [day, month, year] = date.split('.');
  if (!day || !month || !year) return null;
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${time}:00`;
  const parsed = new Date(iso);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function validateForm(formData: CreateEventFormData): CreateEventFormErrors {
  const errors: CreateEventFormErrors = {};

  if (!formData.title.trim()) {
    errors.title = 'Title is required';
  }

  if (!formData.description.trim()) {
    errors.description = 'Description is required';
  }

  if (formData.categoryId === null) {
    errors.categoryId = 'Please select a category';
  }

  if (formData.lat === null || formData.lon === null) {
    errors.location = 'Please select a location';
  }

  if (!formData.startDate || !formData.startTime) {
    errors.startDateTime = 'Start date and time are required';
  } else {
    const parsed = parseDateTime(formData.startDate, formData.startTime);
    if (!parsed) {
      errors.startDateTime = 'Invalid start date/time format';
    }
  }

  if (formData.endDate || formData.endTime) {
    if (!formData.endDate || !formData.endTime) {
      errors.endDateTime = 'Both end date and time are required';
    } else {
      const parsedEnd = parseDateTime(formData.endDate, formData.endTime);
      const parsedStart = parseDateTime(formData.startDate, formData.startTime);
      if (!parsedEnd) {
        errors.endDateTime = 'Invalid end date/time format';
      } else if (parsedStart && new Date(parsedEnd) <= new Date(parsedStart)) {
        errors.endDateTime = 'End must be after start';
      }
    }
  }

  return errors;
}

export function useCreateEventViewModel(): CreateEventViewModel {
  const [formData, setFormData] = useState<CreateEventFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<CreateEventFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setErrors((prev) => ({ ...prev, [field]: null }));
      setApiError(null);
      setSuccessMessage(null);
    },
    [],
  );

  const toggleCategoriesExpanded = useCallback(() => {
    setCategoriesExpanded((prev) => !prev);
  }, []);

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
      locationDescription: '',
    }));
    setLocationSuggestions([]);
  }, []);

  const addInvitedUsername = useCallback(() => {
    setFormData((prev) => {
      const username = prev.inviteUsernameInput.trim();
      if (!username || prev.invitedUsernames.includes(username)) return prev;
      return {
        ...prev,
        invitedUsernames: [...prev.invitedUsernames, username],
        inviteUsernameInput: '',
      };
    });
  }, []);

  const removeInvitedUsername = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      invitedUsernames: prev.invitedUsernames.filter((_, i) => i !== index),
    }));
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
      if (prev.constraints.length >= 5) return prev;
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
      if (prev.constraints.length >= 5) return prev;

      const type = prev.constraintType;
      const typeCounts: Record<ConstraintType, number> = { gender: 0, age: 0, capacity: 0, other: 0 };
      prev.constraints.forEach((c) => {
        const t = c.type as ConstraintType;
        if (t in typeCounts) typeCounts[t]++;
      });

      if (typeCounts[type] >= CONSTRAINT_TYPE_LIMITS[type]) return prev;

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
            if (isNaN(minNum) || minNum < 0 || minNum > 120) return prev;
          }
          if (max) {
            const maxNum = parseInt(max, 10);
            if (isNaN(maxNum) || maxNum < 0 || maxNum > 120) return prev;
          }
          if (min && max) {
            const minNum = parseInt(min, 10);
            const maxNum = parseInt(max, 10);
            if (minNum > maxNum) return prev;
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
          if (isNaN(capNum) || capNum <= 0) return prev;
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

      const constraint: EventConstraint = { type, info };
      return {
        ...prev,
        ...updates,
        constraints: [...prev.constraints, constraint],
      };
    });
    setErrors((prev) => ({ ...prev, constraints: null }));
  }, []);

  const removeConstraint = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      constraints: prev.constraints.filter((_, i) => i !== index),
    }));
  }, []);

  const handleSubmit = useCallback(
    async (token: string): Promise<CreateEventResponse | null> => {
      const validationErrors = validateForm(formData);
      const hasErrors = Object.values(validationErrors).some((e) => e != null);
      if (hasErrors) {
        setErrors(validationErrors);
        return null;
      }

      setIsLoading(true);
      setApiError(null);

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

        const address = formData.locationDescription.trim()
          ? `${formData.address} - ${formData.locationDescription.trim()}`
          : formData.address || undefined;

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
              else if (key === 'start_time') fieldErrors.startDateTime = msg;
              else if (key === 'end_time') fieldErrors.endDateTime = msg;
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
    [formData],
  );

  return {
    formData,
    errors,
    isLoading,
    apiError,
    successMessage,
    locationSuggestions,
    isSearchingLocation,
    categoriesExpanded,
    constraintTypeCounts,
    updateField,
    handleLocationSearch,
    selectLocation,
    clearLocation,
    toggleCategoriesExpanded,
    addInvitedUsername,
    removeInvitedUsername,
    addTag,
    removeTag,
    addGenderConstraint,
    addConstraint,
    removeConstraint,
    handleSubmit,
  };
}
