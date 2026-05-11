import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/services/api';
import { getEventDetail, updateEvent } from '@/services/eventService';
import { useAuth } from '@/contexts/AuthContext';
import {
  EventConstraint,
  EventDetail,
  LocationSuggestion,
  RoutePointInput,
  UpdateEventRequest,
  UpdateEventResponse,
} from '@/models/event';
import {
  CAPACITY_MIN,
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  INITIAL_FORM_DATA,
  ROUTE_MAX_POINTS,
  ROUTE_MIN_POINTS,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
  CreateEventFormData,
  CreateEventFormErrors,
  RouteWaypoint,
  deriveRouteAddress,
  formatDateForForm,
  parseDateTime,
  validateLiveDateInput,
  validateLiveTimeInput,
} from '@/viewmodels/event/useCreateEventViewModel';
import i18n from '@/i18n';

export interface EditEventChangePreview {
  request: UpdateEventRequest;
  changedFields: string[];
  criticalChangeLabels: string[];
}

export interface EditEventViewModel {
  event: EventDetail | null;
  formData: CreateEventFormData;
  errors: CreateEventFormErrors;
  isLoading: boolean;
  isSaving: boolean;
  apiError: string | null;
  successMessage: string | null;
  updateResult: UpdateEventResponse | null;
  locationSuggestions: LocationSuggestion[];
  isSearchingLocation: boolean;
  categoriesExpanded: boolean;
  canEdit: boolean;
  constraintDraftType: string;
  constraintDraftInfo: string;
  previewChanges: () => EditEventChangePreview | null;
  handleSubmit: (request?: UpdateEventRequest) => Promise<UpdateEventResponse | null>;
  updateField: <K extends keyof CreateEventFormData>(
    field: K,
    value: CreateEventFormData[K],
  ) => void;
  handleLocationSearch: (query: string) => void;
  selectLocation: (suggestion: LocationSuggestion) => void;
  clearLocation: () => void;
  setLocationType: (type: CreateEventFormData['locationType']) => void;
  setPointFromCoordinate: (lat: number, lon: number, label?: string | null) => void;
  addRoutePointFromCoordinate: (lat: number, lon: number, label?: string | null) => void;
  addRoutePointFromSuggestion: (suggestion: LocationSuggestion) => void;
  removeRoutePoint: (index: number) => void;
  moveRoutePoint: (index: number, direction: -1 | 1) => void;
  updateRoutePointLabel: (index: number, label: string) => void;
  toggleCategoriesExpanded: () => void;
  updateConstraintDraftType: (value: string) => void;
  updateConstraintDraftInfo: (value: string) => void;
  addConstraint: () => void;
  removeConstraint: (index: number) => void;
  retry: () => Promise<void>;
}

function dateFromIso(iso?: string | null): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return formatDateForForm(parsed);
}

function timeFromIso(iso?: string | null): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
}

function routePointsFromEvent(event: EventDetail): RouteWaypoint[] {
  return (event.location.route_points ?? []).map((point) => ({
    lat: point.lat,
    lon: point.lon,
    label: null,
  }));
}

function formFromEvent(event: EventDetail): CreateEventFormData {
  const isRoute = event.location.type === 'ROUTE';

  return {
    ...INITIAL_FORM_DATA,
    title: event.title,
    description: event.description ?? '',
    categoryId: event.category?.id ?? null,
    locationType: event.location.type,
    locationQuery: event.location.address ?? '',
    address: event.location.address ?? '',
    lat: isRoute ? null : event.location.point?.lat ?? null,
    lon: isRoute ? null : event.location.point?.lon ?? null,
    routePoints: isRoute ? routePointsFromEvent(event) : [],
    startDate: dateFromIso(event.start_time),
    startTime: timeFromIso(event.start_time),
    endDate: dateFromIso(event.end_time),
    endTime: timeFromIso(event.end_time),
    capacityInput: event.capacity != null ? String(event.capacity) : '',
    constraints: event.constraints ?? [],
    privacyLevel: event.privacy_level,
  };
}

function normalizeOptionalString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeConstraints(constraints: EventConstraint[]): EventConstraint[] {
  return constraints
    .map((constraint) => ({
      type: constraint.type.trim(),
      info: constraint.info.trim(),
    }))
    .filter((constraint) => constraint.type.length > 0 && constraint.info.length > 0);
}

function constraintsEqual(a: EventConstraint[], b: EventConstraint[]): boolean {
  const left = normalizeConstraints(a);
  const right = normalizeConstraints(b);
  if (left.length !== right.length) return false;
  return left.every((constraint, index) => (
    constraint.type === right[index].type && constraint.info === right[index].info
  ));
}

function hasAddedConstraint(previous: EventConstraint[], next: EventConstraint[]): boolean {
  const previousKeys = new Set(
    normalizeConstraints(previous).map((constraint) => `${constraint.type}\u0000${constraint.info}`),
  );
  return normalizeConstraints(next).some(
    (constraint) => !previousKeys.has(`${constraint.type}\u0000${constraint.info}`),
  );
}

function sameInstant(a?: string | null, b?: string | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const left = new Date(a).getTime();
  const right = new Date(b).getTime();
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
}

function routePointsEqual(a: RouteWaypoint[], b: RouteWaypoint[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((point, index) => (
    point.lat === b[index].lat && point.lon === b[index].lon
  ));
}

function getCapacityValue(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function addField(
  fields: string[],
  labels: string[],
  field: string,
  label: string,
  critical = true,
) {
  if (!fields.includes(field)) fields.push(field);
  if (critical && !labels.includes(label)) labels.push(label);
}

function buildUpdateRequest(
  formData: CreateEventFormData,
  event: EventDetail,
): EditEventChangePreview {
  const request: UpdateEventRequest = {};
  const changedFields: string[] = [];
  const criticalChangeLabels: string[] = [];

  const title = formData.title.trim();
  if (title !== event.title) {
    request.title = title;
    addField(changedFields, criticalChangeLabels, 'title', i18n.t('events.edit.fields.titleLabel'));
  }

  const description = normalizeOptionalString(formData.description);
  const previousDescription = normalizeOptionalString(event.description ?? '');
  if (description !== previousDescription) {
    request.description = description;
    addField(changedFields, criticalChangeLabels, 'description', i18n.t('events.edit.fields.descriptionLabel'));
  }

  if (formData.categoryId !== (event.category?.id ?? null)) {
    request.category_id = formData.categoryId;
    addField(changedFields, criticalChangeLabels, 'category_id', i18n.t('events.edit.fields.category'));
  }

  const startTime = parseDateTime(formData.startDate, formData.startTime);
  if (startTime && !sameInstant(startTime, event.start_time)) {
    request.start_time = startTime;
    addField(changedFields, criticalChangeLabels, 'start_time', i18n.t('events.edit.fields.startTime'));
  }

  const endTime =
    formData.endDate && formData.endTime
      ? parseDateTime(formData.endDate, formData.endTime)
      : null;
  if (!sameInstant(endTime, event.end_time)) {
    request.end_time = endTime;
    addField(changedFields, criticalChangeLabels, 'end_time', i18n.t('events.edit.fields.endTime'));
  }

  const capacity = getCapacityValue(formData.capacityInput);
  if (capacity !== (event.capacity ?? null)) {
    request.capacity = capacity;
    addField(changedFields, criticalChangeLabels, 'capacity', i18n.t('events.edit.fields.capacity'), false);
  }

  const previousAddress = normalizeOptionalString(event.location.address ?? '');
  const nextAddress =
    formData.locationType === 'ROUTE'
      ? normalizeOptionalString(formData.address) ??
        normalizeOptionalString(deriveRouteAddress(formData.routePoints))
      : normalizeOptionalString(formData.address);

  const locationChanged =
    formData.locationType !== event.location.type ||
    nextAddress !== previousAddress ||
    (formData.locationType === 'POINT' &&
      (formData.lat !== event.location.point?.lat || formData.lon !== event.location.point?.lon)) ||
    (formData.locationType === 'ROUTE' &&
      !routePointsEqual(formData.routePoints, routePointsFromEvent(event)));

  if (locationChanged) {
    request.location_type = formData.locationType;
    request.address = nextAddress;
    if (formData.locationType === 'POINT') {
      request.lat = formData.lat ?? undefined;
      request.lon = formData.lon ?? undefined;
    } else {
      request.route_points = formData.routePoints.map<RoutePointInput>((point) => ({
        lat: point.lat,
        lon: point.lon,
      }));
    }
    addField(changedFields, criticalChangeLabels, 'location', i18n.t('events.edit.fields.locationOrRoute'));
  }

  const constraints = normalizeConstraints(formData.constraints);
  if (!constraintsEqual(constraints, event.constraints ?? [])) {
    request.constraints = constraints;
    addField(
      changedFields,
      criticalChangeLabels,
      'constraints',
      i18n.t('events.edit.fields.requirements'),
      hasAddedConstraint(event.constraints ?? [], constraints),
    );
  }

  return { request, changedFields, criticalChangeLabels };
}

function mapApiValidationErrors(err: ApiError): CreateEventFormErrors {
  const fieldErrors: CreateEventFormErrors = {};
  if (!err.details) return fieldErrors;

  for (const [key, message] of Object.entries(err.details)) {
    if (key === 'title') fieldErrors.title = message;
    else if (key === 'description') fieldErrors.description = message;
    else if (key === 'category_id') fieldErrors.categoryId = message;
    else if (
      key === 'address' ||
      key === 'lat' ||
      key === 'lon' ||
      key === 'location_type' ||
      key === 'route_points' ||
      key.startsWith('route_points')
    ) {
      fieldErrors.location = message;
    } else if (key === 'start_time') fieldErrors.startDate = message;
    else if (key === 'end_time') fieldErrors.endDate = message;
    else if (key === 'capacity') fieldErrors.constraints = message;
    else if (key.startsWith('constraints')) fieldErrors.constraints = message;
  }

  return fieldErrors;
}

export function useEditEventViewModel(eventId: string): EditEventViewModel {
  const { token } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [formData, setFormData] = useState<CreateEventFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<CreateEventFormErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [updateResult, setUpdateResult] = useState<UpdateEventResponse | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [constraintDraftType, setConstraintDraftType] = useState('');
  const [constraintDraftInfo, setConstraintDraftInfo] = useState('');

  const canEdit = useMemo(() => {
    if (!event) return false;
    return event.viewer_context.is_host &&
      event.status === 'ACTIVE' &&
      new Date(event.start_time).getTime() > Date.now();
  }, [event]);

  const loadEvent = useCallback(async () => {
    if (!token) {
      setApiError(i18n.t('events.edit.errors.loginRequired'));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setApiError(null);
    try {
      const data = await getEventDetail(eventId, token);
      setEvent(data);
      setFormData(formFromEvent(data));
      setErrors({});
      setSuccessMessage(null);
      setUpdateResult(null);
    } catch (err) {
      setEvent(null);
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else {
        setApiError(i18n.t('events.edit.errors.loadFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [eventId, token]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  const validate = useCallback((): CreateEventFormErrors => {
    const nextErrors: CreateEventFormErrors = {};
    const title = formData.title.trim();
    const description = formData.description.trim();

    if (!title) {
      nextErrors.title = i18n.t('events.edit.errors.titleRequired');
    } else if (title.length < TITLE_MIN_LENGTH) {
      nextErrors.title = i18n.t('events.edit.errors.titleMin', { count: TITLE_MIN_LENGTH });
    } else if (title.length > TITLE_MAX_LENGTH) {
      nextErrors.title = i18n.t('events.edit.errors.titleMax', { count: TITLE_MAX_LENGTH });
    }

    if (description.length > 0 && description.length < DESCRIPTION_MIN_LENGTH) {
      nextErrors.description = i18n.t('events.edit.errors.descriptionMin', { count: DESCRIPTION_MIN_LENGTH });
    } else if (description.length > DESCRIPTION_MAX_LENGTH) {
      nextErrors.description = i18n.t('events.edit.errors.descriptionMax', { count: DESCRIPTION_MAX_LENGTH });
    }

    if (formData.categoryId == null) {
      nextErrors.categoryId = i18n.t('events.edit.errors.categoryRequired');
    }

    if (formData.locationType === 'POINT') {
      if (formData.lat == null || formData.lon == null) {
        nextErrors.location = i18n.t('events.edit.errors.locationRequired');
      }
    } else if (formData.routePoints.length < ROUTE_MIN_POINTS) {
      nextErrors.location = i18n.t('events.edit.errors.routeMin', { count: ROUTE_MIN_POINTS });
    } else if (formData.routePoints.length > ROUTE_MAX_POINTS) {
      nextErrors.location = i18n.t('events.edit.errors.routeMax', { count: ROUTE_MAX_POINTS });
    }

    if (!formData.startDate) {
      nextErrors.startDate = i18n.t('events.edit.errors.startDateRequired');
    } else {
      nextErrors.startDate = validateLiveDateInput(formData.startDate);
    }

    if (!formData.startTime) {
      nextErrors.startTime = i18n.t('events.edit.errors.startTimeRequired');
    } else {
      nextErrors.startTime = validateLiveTimeInput(formData.startTime);
    }

    const startIso = parseDateTime(formData.startDate, formData.startTime);
    if (!nextErrors.startDate && !nextErrors.startTime) {
      if (!startIso) {
        nextErrors.startDate = i18n.t('events.edit.errors.invalidStartDate');
      } else if (new Date(startIso).getTime() <= Date.now()) {
        nextErrors.startDate = i18n.t('events.edit.errors.startFuture');
      }
    }

    const hasEndInput = Boolean(formData.endDate || formData.endTime);
    if (hasEndInput) {
      if (!formData.endDate) {
        nextErrors.endDate = i18n.t('events.edit.errors.endDateRequired');
      } else {
        nextErrors.endDate = validateLiveDateInput(formData.endDate);
      }

      if (!formData.endTime) {
        nextErrors.endTime = i18n.t('events.edit.errors.endTimeRequired');
      } else {
        nextErrors.endTime = validateLiveTimeInput(formData.endTime);
      }

      const endIso = parseDateTime(formData.endDate, formData.endTime);
      if (!nextErrors.endDate && !nextErrors.endTime) {
        if (!endIso) {
          nextErrors.endDate = i18n.t('events.edit.errors.invalidEndDate');
        } else if (startIso && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
          nextErrors.endDate = i18n.t('events.edit.errors.endAfterStart');
        }
      }
    }

    const capacityInput = formData.capacityInput.trim();
    if (capacityInput) {
      const capacity = Number.parseInt(capacityInput, 10);
      if (!Number.isFinite(capacity) || String(capacity) !== capacityInput) {
        nextErrors.constraints = i18n.t('events.edit.errors.capacityWhole');
      } else if (capacity < CAPACITY_MIN) {
        nextErrors.constraints = i18n.t('events.edit.errors.capacityMin', { count: CAPACITY_MIN });
      } else if (
        event &&
        capacity < event.approved_participant_count + event.pending_participant_count
      ) {
        nextErrors.constraints = i18n.t('events.edit.errors.capacityBelowCurrent');
      }
    }

    const invalidConstraint = normalizeConstraints(formData.constraints).length !== formData.constraints.length;
    if (invalidConstraint) {
      nextErrors.constraints = i18n.t('events.edit.errors.requirementComplete');
    }

    return nextErrors;
  }, [event, formData]);

  const previewChanges = useCallback(() => {
    if (!event) return null;
    if (!canEdit) {
      setApiError(i18n.t('events.edit.errors.onlyActiveFuture'));
      return null;
    }

    const validationErrors = validate();
    const hasErrors = Object.values(validationErrors).some((value) => value != null);
    if (hasErrors) {
      setErrors(validationErrors);
      return null;
    }

    const preview = buildUpdateRequest(formData, event);
    if (preview.changedFields.length === 0) {
      setApiError(i18n.t('events.edit.errors.noChanges'));
      return null;
    }

    setErrors({});
    setApiError(null);
    return preview;
  }, [canEdit, event, formData, validate]);

  const handleSubmit = useCallback(async (request?: UpdateEventRequest) => {
    if (!token || !event) return null;

    const preparedRequest = request ?? previewChanges()?.request;
    if (!preparedRequest) return null;

    setIsSaving(true);
    setApiError(null);
    setSuccessMessage(null);
    setUpdateResult(null);

    try {
      const result = await updateEvent(event.id, preparedRequest, token);
      const refreshed = await getEventDetail(event.id, token);
      setEvent(refreshed);
      setFormData(formFromEvent(refreshed));
      setErrors({});
      setUpdateResult(result);
      setSuccessMessage(
        result.reconfirmation_required
          ? i18n.t('events.edit.successWithReconfirmation', {
              count: result.participants_marked_pending,
            })
          : i18n.t('events.edit.success'),
      );
      return result;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details) {
          setErrors(mapApiValidationErrors(err));
        }
        setApiError(err.message);
      } else {
        setApiError(i18n.t('events.edit.errors.updateFailed'));
      }
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [event, previewChanges, token]);

  const updateField = useCallback(
    <K extends keyof CreateEventFormData>(field: K, value: CreateEventFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      const errorKeyMap: Partial<Record<keyof CreateEventFormData, keyof CreateEventFormErrors>> = {
        locationQuery: 'location',
        capacityInput: 'constraints',
      };
      const errorKey = (errorKeyMap[field] ?? field) as keyof CreateEventFormErrors;
      setErrors((prev) => ({ ...prev, [errorKey]: null }));
      setApiError(null);
      setSuccessMessage(null);
      setUpdateResult(null);
    },
    [],
  );

  const handleLocationSearch = useCallback((query: string) => {
    updateField('locationQuery', query);
    if (query.trim().length < 2) {
      setLocationSuggestions([]);
      return;
    }

    setIsSearchingLocation(true);
    import('@/services/eventService')
      .then(({ searchLocation }) => searchLocation(query))
      .then(setLocationSuggestions)
      .catch(() => setLocationSuggestions([]))
      .finally(() => setIsSearchingLocation(false));
  }, [updateField]);

  const selectLocation = useCallback((suggestion: LocationSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      locationQuery: suggestion.display_name,
      address: suggestion.display_name,
      lat: Number.parseFloat(suggestion.lat),
      lon: Number.parseFloat(suggestion.lon),
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

  const setLocationType = useCallback((type: CreateEventFormData['locationType']) => {
    setFormData((prev) => {
      if (prev.locationType === type) return prev;
      return {
        ...prev,
        locationType: type,
        ...(type === 'ROUTE'
          ? { lat: null, lon: null, address: '', locationQuery: '' }
          : { routePoints: [] }),
      };
    });
    setErrors((prev) => ({ ...prev, location: null }));
    setLocationSuggestions([]);
  }, []);

  const setPointFromCoordinate = useCallback((lat: number, lon: number, label?: string | null) => {
    setFormData((prev) => ({
      ...prev,
      lat,
      lon,
      address: label ?? prev.address,
      locationQuery: label ?? prev.locationQuery,
    }));
    setErrors((prev) => ({ ...prev, location: null }));
  }, []);

  const addRoutePointFromCoordinate = useCallback((lat: number, lon: number, label?: string | null) => {
    setFormData((prev) => {
      if (prev.routePoints.length >= ROUTE_MAX_POINTS) return prev;
      return {
        ...prev,
        routePoints: [...prev.routePoints, { lat, lon, label: label ?? null }],
      };
    });
    setErrors((prev) => ({ ...prev, location: null }));
  }, []);

  const addRoutePointFromSuggestion = useCallback((suggestion: LocationSuggestion) => {
    const lat = Number.parseFloat(suggestion.lat);
    const lon = Number.parseFloat(suggestion.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    addRoutePointFromCoordinate(lat, lon, suggestion.display_name);
    setFormData((prev) => ({ ...prev, locationQuery: '' }));
    setLocationSuggestions([]);
  }, [addRoutePointFromCoordinate]);

  const removeRoutePoint = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      routePoints: prev.routePoints.filter((_, i) => i !== index),
    }));
  }, []);

  const moveRoutePoint = useCallback((index: number, direction: -1 | 1) => {
    setFormData((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.routePoints.length) return prev;
      const next = [...prev.routePoints];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, routePoints: next };
    });
  }, []);

  const updateRoutePointLabel = useCallback((index: number, label: string) => {
    setFormData((prev) => {
      if (index < 0 || index >= prev.routePoints.length) return prev;
      const next = [...prev.routePoints];
      next[index] = { ...next[index], label };
      return { ...prev, routePoints: next };
    });
  }, []);

  const toggleCategoriesExpanded = useCallback(() => {
    setCategoriesExpanded((prev) => !prev);
  }, []);

  const addConstraint = useCallback(() => {
    const type = constraintDraftType.trim();
    const info = constraintDraftInfo.trim();
    if (!type || !info) {
      setErrors((prev) => ({ ...prev, constraints: i18n.t('events.edit.errors.requirementComplete') }));
      return;
    }

    setFormData((prev) => {
      if (prev.constraints.length >= 5) {
        setErrors((errors) => ({ ...errors, constraints: i18n.t('events.edit.errors.maxRequirements') }));
        return prev;
      }
      return {
        ...prev,
        constraints: [...prev.constraints, { type, info }],
      };
    });
    setConstraintDraftType('');
    setConstraintDraftInfo('');
    setErrors((prev) => ({ ...prev, constraints: null }));
  }, [constraintDraftInfo, constraintDraftType]);

  const removeConstraint = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      constraints: prev.constraints.filter((_, i) => i !== index),
    }));
  }, []);

  return {
    event,
    formData,
    errors,
    isLoading,
    isSaving,
    apiError,
    successMessage,
    updateResult,
    locationSuggestions,
    isSearchingLocation,
    categoriesExpanded,
    canEdit,
    constraintDraftType,
    constraintDraftInfo,
    previewChanges,
    handleSubmit,
    updateField,
    handleLocationSearch,
    selectLocation,
    clearLocation,
    setLocationType,
    setPointFromCoordinate,
    addRoutePointFromCoordinate,
    addRoutePointFromSuggestion,
    removeRoutePoint,
    moveRoutePoint,
    updateRoutePointLabel,
    toggleCategoriesExpanded,
    updateConstraintDraftType: setConstraintDraftType,
    updateConstraintDraftInfo: setConstraintDraftInfo,
    addConstraint,
    removeConstraint,
    retry: loadEvent,
  };
}
