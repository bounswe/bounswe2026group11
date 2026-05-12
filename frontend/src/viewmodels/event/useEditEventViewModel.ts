import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/services/api';
import {
  getEventDetail,
  listCategories,
  searchLocation,
  updateEvent,
} from '@/services/eventService';
import {
  MAX_CONSTRAINTS,
  ROUTE_MAX_POINTS,
  ROUTE_MIN_POINTS,
  deriveRouteAddress,
  type RouteWaypoint,
} from '@/viewmodels/event/useCreateEventViewModel';
import type {
  CategoryItem,
  EventConstraint,
  EventDetailResponse,
  LocationSuggestion,
  LocationType,
  UpdateEventRequest,
  UpdateEventResponse,
} from '@/models/event';
import i18n from '@/i18n';

const TITLE_MIN = 10;
const TITLE_MAX = 60;
const DESC_MIN = 20;
const DESC_MAX = 600;
const CAPACITY_MIN = 2;

export interface EditEventFormData {
  title: string;
  description: string;
  categoryId: number | null;
  locationType: LocationType;
  locationQuery: string;
  address: string;
  lat: number | null;
  lon: number | null;
  routePoints: RouteWaypoint[];
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  capacity: string;
  constraints: EventConstraint[];
  constraintType: string;
  constraintInfo: string;
}

export interface EditEventFormErrors {
  title?: string | null;
  description?: string | null;
  categoryId?: string | null;
  location?: string | null;
  startDate?: string | null;
  startTime?: string | null;
  endDate?: string | null;
  endTime?: string | null;
  capacity?: string | null;
  constraints?: string | null;
}

export interface EditEventChangePreview {
  request: UpdateEventRequest;
  changedFields: string[];
  criticalChangeLabels: string[];
}

const INITIAL_FORM: EditEventFormData = {
  title: '',
  description: '',
  categoryId: null,
  locationType: 'POINT',
  locationQuery: '',
  address: '',
  lat: null,
  lon: null,
  routePoints: [],
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  capacity: '',
  constraints: [],
  constraintType: '',
  constraintInfo: '',
};

function toDatePart(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function toTimePart(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function toISODateTime(date: string, time: string): string | null {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function sameInstant(a?: string | null, b?: string | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const left = new Date(a).getTime();
  const right = new Date(b).getTime();
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
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

function routePointsFromEvent(event: EventDetailResponse): RouteWaypoint[] {
  return event.location.route_points.map((point) => ({
    lat: point.lat,
    lon: point.lon,
    label: null,
  }));
}

function routePointsEqual(a: RouteWaypoint[], b: RouteWaypoint[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((point, index) => (
    point.lat === b[index].lat && point.lon === b[index].lon
  ));
}

function formFromEvent(event: EventDetailResponse): EditEventFormData {
  const isRoute = event.location.type === 'ROUTE';
  return {
    ...INITIAL_FORM,
    title: event.title,
    description: event.description ?? '',
    categoryId: event.category?.id ?? null,
    locationType: event.location.type,
    locationQuery: event.location.address ?? '',
    address: event.location.address ?? '',
    lat: isRoute ? null : event.location.point?.lat ?? null,
    lon: isRoute ? null : event.location.point?.lon ?? null,
    routePoints: isRoute ? routePointsFromEvent(event) : [],
    startDate: toDatePart(event.start_time),
    startTime: toTimePart(event.start_time),
    endDate: toDatePart(event.end_time),
    endTime: toTimePart(event.end_time),
    capacity: event.capacity != null ? String(event.capacity) : '',
    constraints: event.constraints ?? [],
  };
}

function addField(
  changedFields: string[],
  criticalLabels: string[],
  field: string,
  label: string,
  critical = true,
) {
  if (!changedFields.includes(field)) changedFields.push(field);
  if (critical && !criticalLabels.includes(label)) criticalLabels.push(label);
}

function buildUpdateRequest(
  form: EditEventFormData,
  event: EventDetailResponse,
): EditEventChangePreview {
  const request: UpdateEventRequest = {};
  const changedFields: string[] = [];
  const criticalChangeLabels: string[] = [];

  const title = form.title.trim();
  if (title !== event.title) {
    request.title = title;
    addField(changedFields, criticalChangeLabels, 'title', 'edit_event.cc_title');
  }

  const description = normalizeOptionalString(form.description);
  if (description !== normalizeOptionalString(event.description)) {
    request.description = description;
    addField(changedFields, criticalChangeLabels, 'description', 'edit_event.cc_description');
  }

  if (form.categoryId !== (event.category?.id ?? null)) {
    request.category_id = form.categoryId;
    addField(changedFields, criticalChangeLabels, 'category_id', 'edit_event.cc_category');
  }

  const startTime = toISODateTime(form.startDate, form.startTime);
  if (startTime && !sameInstant(startTime, event.start_time)) {
    request.start_time = startTime;
    addField(changedFields, criticalChangeLabels, 'start_time', 'edit_event.cc_start_time');
  }

  const endTime = form.endDate || form.endTime ? toISODateTime(form.endDate, form.endTime) : null;
  if (!sameInstant(endTime, event.end_time)) {
    request.end_time = endTime;
    addField(changedFields, criticalChangeLabels, 'end_time', 'edit_event.cc_end_time');
  }

  const capacity = form.capacity.trim() ? Number.parseInt(form.capacity.trim(), 10) : null;
  if (capacity !== (event.capacity ?? null)) {
    request.capacity = capacity;
    addField(changedFields, criticalChangeLabels, 'capacity', '', false);
  }

  const previousAddress = normalizeOptionalString(event.location.address);
  const nextAddress = form.locationType === 'ROUTE'
    ? normalizeOptionalString(form.address) ?? normalizeOptionalString(deriveRouteAddress(form.routePoints))
    : normalizeOptionalString(form.address);
  const locationChanged =
    form.locationType !== event.location.type ||
    nextAddress !== previousAddress ||
    (form.locationType === 'POINT' &&
      (form.lat !== event.location.point?.lat || form.lon !== event.location.point?.lon)) ||
    (form.locationType === 'ROUTE' &&
      !routePointsEqual(form.routePoints, routePointsFromEvent(event)));

  if (locationChanged) {
    request.location_type = form.locationType;
    request.address = nextAddress;
    if (form.locationType === 'POINT') {
      request.lat = form.lat ?? undefined;
      request.lon = form.lon ?? undefined;
    } else {
      request.route_points = form.routePoints.map((point) => ({ lat: point.lat, lon: point.lon }));
    }
    addField(changedFields, criticalChangeLabels, 'location', 'edit_event.cc_location');
  }

  const constraints = normalizeConstraints(form.constraints);
  if (!constraintsEqual(constraints, event.constraints ?? [])) {
    request.constraints = constraints;
    addField(
      changedFields,
      criticalChangeLabels,
      'constraints',
      'edit_event.cc_constraints',
      hasAddedConstraint(event.constraints ?? [], constraints),
    );
  }

  return { request, changedFields, criticalChangeLabels };
}

function validateForm(form: EditEventFormData, event: EventDetailResponse | null): EditEventFormErrors {
  const errors: EditEventFormErrors = {};
  const title = form.title.trim();
  const description = form.description.trim();

  if (!title) errors.title = i18n.t('errors.create_event_title_required');
  else if (title.length < TITLE_MIN) errors.title = i18n.t('errors.create_event_title_min', { count: TITLE_MIN });
  else if (title.length > TITLE_MAX) errors.title = i18n.t('errors.create_event_title_max', { count: TITLE_MAX });

  if (description && description.length < DESC_MIN) {
    errors.description = i18n.t('errors.create_event_description_min', { count: DESC_MIN });
  } else if (description.length > DESC_MAX) {
    errors.description = i18n.t('errors.create_event_description_max', { count: DESC_MAX });
  }

  if (form.categoryId == null) errors.categoryId = i18n.t('errors.edit_event_select_category');

  if (form.locationType === 'POINT') {
    if (form.lat == null || form.lon == null) errors.location = i18n.t('errors.edit_event_select_location');
  } else if (form.routePoints.length < ROUTE_MIN_POINTS) {
    errors.location = i18n.t('errors.create_event_route_min_points', { count: ROUTE_MIN_POINTS });
  } else if (form.routePoints.length > ROUTE_MAX_POINTS) {
    errors.location = i18n.t('errors.create_event_route_max_points', { count: ROUTE_MAX_POINTS });
  }

  if (!form.startDate) errors.startDate = i18n.t('errors.create_event_start_date_required');
  if (!form.startTime) errors.startTime = i18n.t('errors.create_event_start_time_required');
  const startIso = toISODateTime(form.startDate, form.startTime);
  if (!errors.startDate && !errors.startTime) {
    if (!startIso) errors.startDate = i18n.t('errors.create_event_start_date_invalid');
    else if (new Date(startIso).getTime() <= Date.now()) {
      errors.startDate = i18n.t('errors.edit_event_start_must_be_future');
    }
  }

  if (form.endDate || form.endTime) {
    if (!form.endDate) errors.endDate = i18n.t('errors.create_event_end_date_required');
    if (!form.endTime) errors.endTime = i18n.t('errors.create_event_end_time_required');
    const endIso = toISODateTime(form.endDate, form.endTime);
    if (!errors.endDate && !errors.endTime) {
      if (!endIso) errors.endDate = i18n.t('errors.create_event_end_date_invalid');
      else if (startIso && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
        errors.endTime = i18n.t('errors.create_event_end_time_before_start');
      }
    }
  }

  if (form.capacity.trim()) {
    const capacity = Number.parseInt(form.capacity.trim(), 10);
    if (!Number.isFinite(capacity) || String(capacity) !== form.capacity.trim()) {
      errors.capacity = i18n.t('errors.edit_event_capacity_whole_number');
    } else if (capacity < CAPACITY_MIN) {
      errors.capacity = i18n.t('errors.create_event_capacity_min', { count: CAPACITY_MIN });
    } else if (event && capacity < event.approved_participant_count + event.pending_participant_count) {
      errors.capacity = i18n.t('errors.edit_event_capacity_below_participants');
    }
  }

  if (normalizeConstraints(form.constraints).length !== form.constraints.length) {
    errors.constraints = i18n.t('errors.edit_event_constraints_incomplete');
  }

  return errors;
}

function mapApiValidationErrors(err: ApiError): EditEventFormErrors {
  const errors: EditEventFormErrors = {};
  if (!err.details) return errors;
  for (const [key, message] of Object.entries(err.details)) {
    if (key === 'title') errors.title = message;
    else if (key === 'description') errors.description = message;
    else if (key === 'category_id') errors.categoryId = message;
    else if (['address', 'lat', 'lon', 'location_type', 'route_points'].includes(key) || key.startsWith('route_points')) {
      errors.location = message;
    } else if (key === 'start_time') errors.startDate = message;
    else if (key === 'end_time') errors.endDate = message;
    else if (key === 'capacity') errors.capacity = message;
    else if (key.startsWith('constraints')) errors.constraints = message;
  }
  return errors;
}

export function useEditEventViewModel(eventId: string | undefined) {
  const { token } = useAuth();
  const [event, setEvent] = useState<EventDetailResponse | null>(null);
  const [form, setForm] = useState<EditEventFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<EditEventFormErrors>({});
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [locationResults, setLocationResults] = useState<LocationSuggestion[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [updateResult, setUpdateResult] = useState<UpdateEventResponse | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const canEdit = Boolean(
    event?.viewer_context.is_host &&
    event.status === 'ACTIVE' &&
    new Date(event.start_time).getTime() > Date.now(),
  );

  const load = useCallback(async () => {
    if (!eventId) {
      setApiError(i18n.t('errors.edit_event_not_found'));
      setIsLoading(false);
      return;
    }
    if (!token) {
      setApiError(i18n.t('errors.edit_event_login_required'));
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setApiError(null);
    try {
      const [eventData, categoryData] = await Promise.all([
        getEventDetail(eventId, token),
        listCategories().catch(() => ({ items: [] as CategoryItem[] })),
      ]);
      setEvent(eventData);
      setForm(formFromEvent(eventData));
      setCategories(categoryData.items);
      setErrors({});
      setSuccessMessage(null);
      setUpdateResult(null);
    } catch (err) {
      setEvent(null);
      setApiError(err instanceof ApiError ? err.message : i18n.t('errors.edit_event_load_failed'));
    } finally {
      setIsLoading(false);
    }
  }, [eventId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateField = useCallback(<K extends keyof EditEventFormData>(field: K, value: EditEventFormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
    setApiError(null);
    setSuccessMessage(null);
    setUpdateResult(null);
  }, []);

  const previewChanges = useCallback((): EditEventChangePreview | null => {
    if (!event) return null;
    if (!canEdit) {
      setApiError(i18n.t('errors.edit_event_not_editable'));
      return null;
    }
    const nextErrors = validateForm(form, event);
    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      return null;
    }
    const preview = buildUpdateRequest(form, event);
    if (preview.changedFields.length === 0) {
      setApiError(i18n.t('errors.edit_event_no_changes'));
      return null;
    }
    setErrors({});
    setApiError(null);
    return preview;
  }, [canEdit, event, form]);

  const handleSubmit = useCallback(async (request?: UpdateEventRequest) => {
    if (!event || !token) return null;
    const prepared = request ?? previewChanges()?.request;
    if (!prepared) return null;
    setIsSaving(true);
    setApiError(null);
    setSuccessMessage(null);
    setUpdateResult(null);
    try {
      const result = await updateEvent(event.id, prepared, token);
      const refreshed = await getEventDetail(event.id, token);
      setEvent(refreshed);
      setForm(formFromEvent(refreshed));
      setUpdateResult(result);
      if (typeof window !== 'undefined') {
        const updatedEventSummary = {
          eventId: refreshed.id,
          title: refreshed.title,
          status: refreshed.status,
          category_name: refreshed.category?.name ?? null,
          start_time: refreshed.start_time,
          end_time: refreshed.end_time,
          location_address: refreshed.location.address,
          approved_participant_count: refreshed.approved_participant_count,
          image_url: refreshed.image_url,
          privacy_level: refreshed.privacy_level,
          host_score: refreshed.host_score,
        };
        try {
          window.sessionStorage.setItem(
            'sem_recent_event_update',
            JSON.stringify(updatedEventSummary),
          );
        } catch {
          /* ignore */
        }
        window.dispatchEvent(
          new CustomEvent('sem:event-updated', {
            detail: updatedEventSummary,
          }),
        );
      }
      const pendingReconfirmationCount = Math.max(
        refreshed.pending_participant_count,
        result.participants_marked_pending,
      );
      setSuccessMessage(
        result.reconfirmation_required
          ? i18n.t('edit_event.success_reconfirmation', {
              count: pendingReconfirmationCount,
            })
          : i18n.t('edit_event.success_message_plain'),
      );
      return result;
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mapApiValidationErrors(err));
        setApiError(err.message);
      } else {
        setApiError(i18n.t('errors.edit_event_update_failed'));
      }
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [event, previewChanges, token]);

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
        setLocationResults(await searchLocation(query));
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
      lat: Number.parseFloat(suggestion.lat),
      lon: Number.parseFloat(suggestion.lon),
    }));
    setLocationResults([]);
    setErrors((prev) => ({ ...prev, location: null }));
  }, []);

  const setLocationType = useCallback((type: LocationType) => {
    setForm((prev) => (
      prev.locationType === type
        ? prev
        : {
            ...prev,
            locationType: type,
            locationQuery: '',
            address: '',
            lat: null,
            lon: null,
            routePoints: type === 'ROUTE' ? prev.routePoints : [],
          }
    ));
    setLocationResults([]);
    setErrors((prev) => ({ ...prev, location: null }));
  }, []);

  const addRoutePointFromSuggestion = useCallback((suggestion: LocationSuggestion) => {
    const lat = Number.parseFloat(suggestion.lat);
    const lon = Number.parseFloat(suggestion.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;
    setForm((prev) => {
      if (prev.routePoints.length >= ROUTE_MAX_POINTS) return prev;
      return {
        ...prev,
        locationQuery: '',
        routePoints: [...prev.routePoints, { lat, lon, label: suggestion.display_name }],
      };
    });
    setLocationResults([]);
    setErrors((prev) => ({ ...prev, location: null }));
  }, []);

  const addRoutePointFromCoordinate = useCallback((lat: number, lon: number, label?: string | null) => {
    setForm((prev) => {
      if (prev.routePoints.length >= ROUTE_MAX_POINTS) return prev;
      return { ...prev, routePoints: [...prev.routePoints, { lat, lon, label: label ?? null }] };
    });
    setErrors((prev) => ({ ...prev, location: null }));
  }, []);

  const removeRoutePoint = useCallback((index: number) => {
    setForm((prev) => ({ ...prev, routePoints: prev.routePoints.filter((_, i) => i !== index) }));
  }, []);

  const moveRoutePoint = useCallback((index: number, direction: -1 | 1) => {
    setForm((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.routePoints.length) return prev;
      const next = [...prev.routePoints];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, routePoints: next };
    });
  }, []);

  const updateRoutePointLabel = useCallback((index: number, label: string) => {
    setForm((prev) => {
      if (index < 0 || index >= prev.routePoints.length) return prev;
      const next = [...prev.routePoints];
      next[index] = { ...next[index], label };
      return { ...prev, routePoints: next };
    });
  }, []);

  const addConstraint = useCallback(() => {
    setForm((prev) => {
      if (prev.constraints.length >= MAX_CONSTRAINTS) return prev;
      const type = prev.constraintType.trim();
      const info = prev.constraintInfo.trim();
      if (!type || !info) return prev;
      return {
        ...prev,
        constraints: [...prev.constraints, { type, info }],
        constraintType: '',
        constraintInfo: '',
      };
    });
  }, []);

  const removeConstraint = useCallback((index: number) => {
    setForm((prev) => ({ ...prev, constraints: prev.constraints.filter((_, i) => i !== index) }));
  }, []);

  return {
    event,
    form,
    errors,
    categories,
    locationResults,
    locationSearching,
    isLoading,
    isSaving,
    apiError,
    successMessage,
    updateResult,
    canEdit,
    retry: load,
    updateField,
    previewChanges,
    handleSubmit,
    handleLocationSearch,
    selectLocation,
    setLocationType,
    addRoutePointFromSuggestion,
    addRoutePointFromCoordinate,
    removeRoutePoint,
    moveRoutePoint,
    updateRoutePointLabel,
    addConstraint,
    removeConstraint,
  };
}
