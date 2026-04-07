import { useState, useCallback, useEffect, useRef } from 'react';
import {
  createEvent,
  listCategories,
  searchLocation,
  getEventImageUploadUrl,
  confirmEventImageUpload,
} from '@/services/eventService';
import { prepareAvatarBlobs } from '@/utils/imageResize';
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
  /** Local file to upload via presigned URLs after the event is created. */
  imageFile: File | null;
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
  image?: string | null;
  title?: string | null;
  description?: string | null;
  categoryId?: string | null;
  location?: string | null;
  startDate?: string | null;
  startTime?: string | null;
  endDate?: string | null;
  endTime?: string | null;
  tags?: string | null;
  capacity?: string | null;
  minimumAge?: string | null;
  maximumAge?: string | null;
}

type CreateEventTouchedFields = Partial<Record<keyof CreateEventFormErrors, boolean>>;

const INITIAL: CreateEventFormData = {
  title: '',
  description: '',
  imageFile: null,
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

function toDateOnly(date: string): Date | null {
  if (!date) return null;
  const dt = new Date(`${date}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
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

  if (!form.imageFile) {
    errors.image = 'Event image is required.';
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

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const startDateOnly = form.startDate ? toDateOnly(form.startDate) : null;
  if (form.startDate && !startDateOnly) {
    errors.startDate = 'Invalid start date.';
  } else if (startDateOnly && startDateOnly < today) {
    errors.startDate = 'Start date must be today or later.';
  }

  const startISO = !errors.startDate && form.startDate && form.startTime
    ? toISODateTime(form.startDate, form.startTime)
    : null;

  if (!errors.startDate && form.startDate && form.startTime && !startISO) {
    errors.startTime = 'Invalid start time.';
  } else if (
    !errors.startDate
    && startDateOnly
    && startDateOnly.getTime() === today.getTime()
    && startISO
    && new Date(startISO) <= now
  ) {
    errors.startTime = 'Start time must be in the future.';
  }

  if (form.endDate || form.endTime) {
    if (!form.endDate) errors.endDate = 'End date is required if end time is set.';
    if (!form.endTime) errors.endTime = 'End time is required if end date is set.';

    const endDateOnly = form.endDate ? toDateOnly(form.endDate) : null;
    if (form.endDate && !endDateOnly) {
      errors.endDate = 'Invalid end date.';
    } else if (!errors.startDate && startDateOnly && endDateOnly && endDateOnly < startDateOnly) {
      errors.endDate = 'End date must be on or after start date.';
    }

    const endISO = !errors.endDate && form.endDate && form.endTime
      ? toISODateTime(form.endDate, form.endTime)
      : null;

    if (!errors.endDate && form.endDate && form.endTime && !endISO) {
      errors.endTime = 'Invalid end time.';
    } else if (
      !errors.endDate
      && !errors.startDate
      && startDateOnly
      && endDateOnly
      && startISO
      && endISO
      && endDateOnly.getTime() === startDateOnly.getTime()
      && new Date(endISO) <= new Date(startISO)
    ) {
      errors.endTime = 'End time must be after start time.';
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
  const [touched, setTouched] = useState<CreateEventTouchedFields>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageUploadSuccessMessage, setImageUploadSuccessMessage] = useState<string | null>(null);
  const [coverImageUploadedForLastCreate, setCoverImageUploadedForLastCreate] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [locationResults, setLocationResults] = useState<LocationSuggestion[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const imagePreviewBlobUrlRef = useRef<string | null>(null);
  const imageUploadSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearImageUploadSuccessToast = useCallback(() => {
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

  const revokeImagePreviewUrl = useCallback(() => {
    if (imagePreviewBlobUrlRef.current) {
      URL.revokeObjectURL(imagePreviewBlobUrlRef.current);
      imagePreviewBlobUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => revokeImagePreviewUrl(), [revokeImagePreviewUrl]);

  useEffect(() => {
    listCategories()
      .then((res) => setCategories(res.items))
      .catch(() => {});
  }, []);

  const getVisibleErrors = useCallback(
    (nextForm: CreateEventFormData, nextTouched: CreateEventTouchedFields, forceAll = false) => {
      const validationErrors = validateForm(nextForm);
      if (forceAll) return validationErrors;

      const visibleErrors: CreateEventFormErrors = {};
      (Object.keys(validationErrors) as (keyof CreateEventFormErrors)[]).forEach((key) => {
        if (nextTouched[key]) {
          visibleErrors[key] = validationErrors[key];
        }
      });
      return visibleErrors;
    },
    [],
  );

  const updateField = useCallback(
    <K extends keyof CreateEventFormData>(field: K, value: CreateEventFormData[K]) => {
      setForm((prev) => {
        const nextForm = { ...prev, [field]: value };
        setErrors(getVisibleErrors(nextForm, touched, submitAttempted));
        return nextForm;
      });
      setApiError(null);
      setImageError(null);
      setSuccessMessage(null);
      clearImageUploadSuccessToast();
      setCoverImageUploadedForLastCreate(false);
    },
    [clearImageUploadSuccessToast, getVisibleErrors, submitAttempted, touched],
  );

  const touchField = useCallback(
    (field: keyof CreateEventFormErrors) => {
      setTouched((prev) => {
        if (prev[field]) return prev;
        const nextTouched = { ...prev, [field]: true };
        setErrors(getVisibleErrors(form, nextTouched, submitAttempted));
        return nextTouched;
      });
    },
    [form, getVisibleErrors, submitAttempted],
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
    setForm((prev) => {
      const nextForm = {
        ...prev,
        locationQuery: suggestion.display_name,
        address: suggestion.display_name,
        lat: parseFloat(suggestion.lat),
        lon: parseFloat(suggestion.lon),
      };
      setErrors(getVisibleErrors(nextForm, touched, submitAttempted));
      return nextForm;
    });
    setLocationResults([]);
  }, [getVisibleErrors, submitAttempted, touched]);

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

  const handleImageUpload = useCallback(
    (file: File | null) => {
      revokeImagePreviewUrl();
      setImageError(null);
      if (!file) {
        setTouched((prev) => {
          const nextTouched = { ...prev, image: true };
          setForm((currentForm) => {
            const nextForm = { ...currentForm, imageFile: null, imagePreview: '' };
            setErrors(getVisibleErrors(nextForm, nextTouched, submitAttempted));
            return nextForm;
          });
          return nextTouched;
        });
        return;
      }
      const url = URL.createObjectURL(file);
      imagePreviewBlobUrlRef.current = url;
      setTouched((prev) => {
        const nextTouched = { ...prev, image: true };
        setForm((currentForm) => {
          const nextForm = { ...currentForm, imageFile: file, imagePreview: url };
          setErrors(getVisibleErrors(nextForm, nextTouched, submitAttempted));
          return nextForm;
        });
        return nextTouched;
      });
    },
    [getVisibleErrors, revokeImagePreviewUrl, submitAttempted],
  );

  const removeImage = useCallback(() => {
    revokeImagePreviewUrl();
    setImageError(null);
    setTouched((prev) => {
      const nextTouched = { ...prev, image: true };
      setForm((currentForm) => {
        const nextForm = { ...currentForm, imageFile: null, imagePreview: '' };
        setErrors(getVisibleErrors(nextForm, nextTouched, submitAttempted));
        return nextForm;
      });
      return nextTouched;
    });
  }, [getVisibleErrors, revokeImagePreviewUrl, submitAttempted]);

  const removeConstraint = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      constraints: prev.constraints.filter((_, i) => i !== index),
    }));
  }, []);

  const handleSubmit = useCallback(
    async (token: string): Promise<CreateEventResponse | null> => {
      setSubmitAttempted(true);
      const validationErrors = validateForm(form);
      const hasErrors = Object.values(validationErrors).some((e) => e != null);
      if (hasErrors) {
        setErrors(validationErrors);
        return null;
      }

      setIsLoading(true);
      setApiError(null);
      setImageError(null);
      clearImageUploadSuccessToast();
      setCoverImageUploadedForLastCreate(false);
      try {
        const startTime = toISODateTime(form.startDate, form.startTime)!;
        const endTime = toISODateTime(form.endDate, form.endTime);

        const request = {
          title: form.title.trim(),
          description: form.description.trim(),
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

        if (form.imageFile) {
          setIsUploadingImage(true);
          setImageError(null);
          try {
            const { original, small } = await prepareAvatarBlobs(form.imageFile);
            const uploadInit = await getEventImageUploadUrl(result.id, token);
            for (const instruction of uploadInit.uploads) {
              const blob = instruction.variant === 'ORIGINAL' ? original : small;
              const res = await fetch(instruction.url, {
                method: instruction.method,
                headers: instruction.headers,
                body: blob,
              });
              if (!res.ok) {
                throw new Error(`Image upload failed (${instruction.variant}).`);
              }
            }
            await confirmEventImageUpload(
              result.id,
              { confirm_token: uploadInit.confirm_token },
              token,
            );
            setCoverImageUploadedForLastCreate(true);
            if (imageUploadSuccessTimerRef.current) clearTimeout(imageUploadSuccessTimerRef.current);
            setImageUploadSuccessMessage('Cover image uploaded successfully.');
            imageUploadSuccessTimerRef.current = setTimeout(() => {
              setImageUploadSuccessMessage(null);
              imageUploadSuccessTimerRef.current = null;
            }, 5000);
          } catch (err) {
            if (err instanceof ApiError) {
              setImageError(err.message);
            } else {
              setImageError(
                err instanceof Error
                  ? err.message
                  : 'The event was created, but the cover image could not be uploaded.',
              );
            }
          } finally {
            setIsUploadingImage(false);
          }
        }

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
    [form, clearImageUploadSuccessToast],
  );

  return {
    form,
    errors,
    isLoading,
    isUploadingImage,
    apiError,
    imageError,
    imageUploadSuccessMessage,
    coverImageUploadedForLastCreate,
    dismissImageUploadSuccess: clearImageUploadSuccessToast,
    successMessage,
    categories,
    locationResults,
    locationSearching,
    touchField,
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
