import { useState, useCallback, useEffect, useRef } from 'react';
import {
  createEvent,
  listCategories,
  searchLocation,
} from '@/services/eventService';
import {
  CreateEventResponse,
  CategoryItem,
  LocationSuggestion,
  type PrivacyLevel,
  type PreferredGender,
  type EventConstraint,
} from '@/models/event';
import { ApiError } from '@/services/api';

const TITLE_MIN = 10;
const TITLE_MAX = 60;
const DESC_MIN = 20;
const DESC_MAX = 600;
const CAPACITY_MIN = 2;
const MAX_TAGS = 5;
const TAG_MAX_LENGTH = 20;
export const MAX_CONSTRAINTS = 5;

export const PRIVACY_OPTIONS: { label: string; value: PrivacyLevel }[] = [
  { label: 'Public', value: 'PUBLIC' },
  { label: 'Protected', value: 'PROTECTED' },
];

export type ConstraintType = 'gender' | 'age' | 'capacity' | 'other';

export interface CreateEventFormData {
  title: string;
  description: string;
  imageUrl: string;
  imagePreview: string;
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
  capacity: string;
  minimumAge: string;
  maximumAge: string;
  preferredGender: PreferredGender | '';
  constraints: EventConstraint[];
  constraintType: ConstraintType;
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
  imageUrl?: string | null;
  tags?: string | null;
  capacity?: string | null;
  minimumAge?: string | null;
  maximumAge?: string | null;
}

const INITIAL: CreateEventFormData = {
  title: '',
  description: '',
  imageUrl: '',
  imagePreview: '',
  categoryId: null,
  locationQuery: '',
  address: '',
  lat: null,
  lon: null,
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  privacyLevel: 'PUBLIC',
  tags: [],
  tagInput: '',
  capacity: '',
  minimumAge: '',
  maximumAge: '',
  preferredGender: '',
  constraints: [],
  constraintType: 'other',
  otherConstraintInput: '',
};

function toISODateTime(date: string, time: string): string | null {
  if (!date || !time) return null;
  try {
    const dt = new Date(`${date}T${time}`);
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString();
  } catch {
    return null;
  }
}

function validateForm(form: CreateEventFormData): CreateEventFormErrors {
  const errors: CreateEventFormErrors = {};

  if (!form.title.trim()) {
    errors.title = 'Title is required.';
  } else if (form.title.trim().length < TITLE_MIN) {
    errors.title = `Title must be at least ${TITLE_MIN} characters.`;
  } else if (form.title.trim().length > TITLE_MAX) {
    errors.title = `Title must be at most ${TITLE_MAX} characters.`;
  }

  if (!form.description.trim()) {
    errors.description = 'Description is required.';
  } else if (form.description.trim().length < DESC_MIN) {
    errors.description = `Description must be at least ${DESC_MIN} characters.`;
  } else if (form.description.trim().length > DESC_MAX) {
    errors.description = `Description must be at most ${DESC_MAX} characters.`;
  }

  if (!form.categoryId) {
    errors.categoryId = 'Please select a category.';
  }

  if (form.lat === null || form.lon === null) {
    errors.location = 'Please search and select a location.';
  }

  if (!form.startDate) {
    errors.startDate = 'Start date is required.';
  }
  if (!form.startTime) {
    errors.startTime = 'Start time is required.';
  }

  const startISO = toISODateTime(form.startDate, form.startTime);
  if (form.startDate && form.startTime && !startISO) {
    errors.startDate = 'Invalid start date/time.';
  } else if (startISO && new Date(startISO) <= new Date()) {
    errors.startDate = 'Start time must be in the future.';
  }

  if (form.endDate || form.endTime) {
    if (!form.endDate) errors.endDate = 'End date is required if end time is set.';
    if (!form.endTime) errors.endTime = 'End time is required if end date is set.';
    const endISO = toISODateTime(form.endDate, form.endTime);
    if (form.endDate && form.endTime && !endISO) {
      errors.endDate = 'Invalid end date/time.';
    } else if (startISO && endISO && new Date(endISO) <= new Date(startISO)) {
      errors.endDate = 'End time must be after start time.';
    }
  }

  if (form.capacity) {
    const cap = parseInt(form.capacity, 10);
    if (isNaN(cap) || cap < CAPACITY_MIN) {
      errors.capacity = `Capacity must be at least ${CAPACITY_MIN}.`;
    }
  }

  if (form.minimumAge) {
    const age = parseInt(form.minimumAge, 10);
    if (isNaN(age) || age < 1 || age > 120) {
      errors.minimumAge = 'Enter a valid age (1-120).';
    }
  }

  if (form.maximumAge) {
    const age = parseInt(form.maximumAge, 10);
    if (isNaN(age) || age < 1 || age > 120) {
      errors.maximumAge = 'Enter a valid age (1-120).';
    } else if (form.minimumAge) {
      const minAge = parseInt(form.minimumAge, 10);
      if (!isNaN(minAge) && age <= minAge) {
        errors.maximumAge = 'Maximum age must be greater than minimum age.';
      }
    }
  }

  return errors;
}

export function useCreateEventViewModel() {
  const [form, setForm] = useState<CreateEventFormData>(INITIAL);
  const [errors, setErrors] = useState<CreateEventFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [locationResults, setLocationResults] = useState<LocationSuggestion[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    listCategories()
      .then((res) => setCategories(res.items))
      .catch(() => {});
  }, []);

  const updateField = useCallback(
    <K extends keyof CreateEventFormData>(field: K, value: CreateEventFormData[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: null }));
      setApiError(null);
      setSuccessMessage(null);
    },
    [],
  );

  const handleLocationSearch = useCallback((query: string) => {
    updateField('locationQuery', query);
    updateField('lat', null);
    updateField('lon', null);
    updateField('address', '');
    setLocationResults([]);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (query.trim().length < 3) return;

    searchTimeout.current = setTimeout(async () => {
      setLocationSearching(true);
      try {
        const results = await searchLocation(query);
        setLocationResults(results);
      } catch {
        setLocationResults([]);
      } finally {
        setLocationSearching(false);
      }
    }, 400);
  }, [updateField]);

  const selectLocation = useCallback((suggestion: LocationSuggestion) => {
    setForm((prev) => ({
      ...prev,
      locationQuery: suggestion.display_name,
      address: suggestion.display_name,
      lat: parseFloat(suggestion.lat),
      lon: parseFloat(suggestion.lon),
    }));
    setLocationResults([]);
    setErrors((prev) => ({ ...prev, location: null }));
  }, []);

  const addTag = useCallback(() => {
    setForm((prev) => {
      const tag = prev.tagInput.trim();
      if (!tag || prev.tags.length >= MAX_TAGS || tag.length > TAG_MAX_LENGTH) return prev;
      if (prev.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return prev;
      return { ...prev, tags: [...prev.tags, tag], tagInput: '' };
    });
  }, []);

  const removeTag = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index),
    }));
  }, []);

  const addConstraint = useCallback(() => {
    setForm((prev) => {
      if (prev.constraints.length >= MAX_CONSTRAINTS) return prev;
      let constraint: EventConstraint | null = null;

      if (prev.constraintType === 'other' && prev.otherConstraintInput.trim()) {
        constraint = { type: 'other', info: prev.otherConstraintInput.trim() };
      }

      if (!constraint) return prev;
      return {
        ...prev,
        constraints: [...prev.constraints, constraint],
        otherConstraintInput: '',
      };
    });
  }, []);

  const handleImageUpload = useCallback((file: File | null) => {
    if (!file) {
      setForm((prev) => ({ ...prev, imageUrl: '', imagePreview: '' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setForm((prev) => ({ ...prev, imageUrl: dataUrl, imagePreview: dataUrl }));
    };
    reader.readAsDataURL(file);
  }, []);

  const removeImage = useCallback(() => {
    setForm((prev) => ({ ...prev, imageUrl: '', imagePreview: '' }));
  }, []);

  const removeConstraint = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      constraints: prev.constraints.filter((_, i) => i !== index),
    }));
  }, []);

  const handleSubmit = useCallback(
    async (token: string): Promise<CreateEventResponse | null> => {
      const validationErrors = validateForm(form);
      const hasErrors = Object.values(validationErrors).some((e) => e != null);
      if (hasErrors) {
        setErrors(validationErrors);
        return null;
      }

      setIsLoading(true);
      setApiError(null);
      try {
        const startTime = toISODateTime(form.startDate, form.startTime)!;
        const endTime = toISODateTime(form.endDate, form.endTime);

        const request = {
          title: form.title.trim(),
          description: form.description.trim(),
          image_url: form.imageUrl.trim() || undefined,
          category_id: form.categoryId!,
          address: form.address || undefined,
          lat: form.lat!,
          lon: form.lon!,
          location_type: 'POINT' as const,
          start_time: startTime,
          end_time: endTime || undefined,
          capacity: form.capacity ? parseInt(form.capacity, 10) : undefined,
          privacy_level: form.privacyLevel,
          tags: form.tags.length > 0 ? form.tags : undefined,
          constraints: form.constraints.length > 0 ? form.constraints : undefined,
          minimum_age: form.minimumAge ? parseInt(form.minimumAge, 10) : undefined,
          maximum_age: form.maximumAge ? parseInt(form.maximumAge, 10) : undefined,
          preferred_gender: form.preferredGender || undefined,
        };

        const result = await createEvent(request, token);
        setSuccessMessage('Event created successfully!');
        return result;
      } catch (err) {
        if (err instanceof ApiError) {
          setApiError(err.message);
        } else {
          setApiError('An unexpected error occurred. Please try again.');
        }
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [form],
  );

  return {
    form,
    errors,
    isLoading,
    apiError,
    successMessage,
    categories,
    locationResults,
    locationSearching,
    updateField,
    handleLocationSearch,
    selectLocation,
    addTag,
    removeTag,
    handleImageUpload,
    removeImage,
    addConstraint,
    removeConstraint,
    handleSubmit,
  };
}
