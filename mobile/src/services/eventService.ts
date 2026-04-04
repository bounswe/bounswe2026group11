import { apiGet, apiGetAuth, apiPostAuth, apiPatchAuth } from '@/services/api';
import * as FileSystem from 'expo-file-system/legacy';
import {
  CreateEventRequest,
  CreateEventResponse,
  EventDetail,
  JoinEventResponse,
  LeaveEventResponse,
  LocationSuggestion,
  ListEventsQuery,
  ListCategoriesResponse,
  MyEventRelation,
  MyEventStatus,
  MyEventSummary,
  MyEventsResponse,
  PaginatedEventsResponse,
  RequestJoinRequest,
  RequestJoinResponse,
  ImageUploadInitResponse,
} from '@/models/event';


const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
type SupportedUploadMethod = 'POST' | 'PUT' | 'PATCH';

interface BackendEventSummary {
  id: string;
  title: string;
  start_time: string;
  end_time?: string | null;
  status: string;
  category?: string | null;
  image_url?: string | null;
  participants_count?: number | null;
  location_address?: string | null;
}

interface BackendEventsListResponse {
  events: BackendEventSummary[];
}


export async function createEvent(
  request: CreateEventRequest,
  token: string,
): Promise<CreateEventResponse> {
  return apiPostAuth<CreateEventResponse>('/events', request, token);
}

export async function getEventDetail(
  id: string,
  token: string,
): Promise<EventDetail> {
  return apiGetAuth<EventDetail>(`/events/${id}`, token);
}

export async function joinEvent(
  id: string,
  token: string,
): Promise<JoinEventResponse> {
  return apiPostAuth<JoinEventResponse>(`/events/${id}/join`, {}, token);
}

export async function requestJoinEvent(
  id: string,
  body: RequestJoinRequest,
  token: string,
): Promise<RequestJoinResponse> {
  return apiPostAuth<RequestJoinResponse>(`/events/${id}/join-request`, body, token);
}

export async function approveJoinRequest(
  eventId: string,
  joinRequestId: string,
  token: string,
): Promise<any> {
  return apiPostAuth<any>(
    `/events/${eventId}/join-requests/${joinRequestId}/approve`,
    {},
    token,
  );
}

export async function rejectJoinRequest(
  eventId: string,
  joinRequestId: string,
  token: string,
): Promise<any> {
  return apiPostAuth<any>(
    `/events/${eventId}/join-requests/${joinRequestId}/reject`,
    {},
    token,
  );
}

export async function leaveEvent(
  eventId: string,
  token: string,
): Promise<LeaveEventResponse> {
  return apiPatchAuth<LeaveEventResponse>(`/events/${eventId}/leave`, {}, token);
}

export async function cancelEvent(
  eventId: string,
  token: string,
): Promise<any> {
  return apiPatchAuth<any>(`/events/${eventId}/cancel`, {}, token);
}

export async function searchLocation(
  query: string,
): Promise<LocationSuggestion[]> {
  if (query.trim().length < 2) return [];

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    limit: '5',
  });

  const response = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: { 'User-Agent': 'BounSWE2026Group11MobileApp' },
  });

  if (!response.ok) return [];

  const data = await response.json();
  return data.map(
    (item: { display_name: string; lat: string; lon: string }) => ({
      display_name: item.display_name,
      lat: item.lat,
      lon: item.lon,
    }),
  );
}

export async function listCategories(): Promise<ListCategoriesResponse> {
  return apiGet<ListCategoriesResponse>('/categories');
}

function appendArrayParam(
  params: URLSearchParams,
  key: string,
  values?: Array<string | number>,
) {
  if (!values || values.length === 0) return;
  params.set(key, values.join(','));
}

export async function getEventImageUploadUrl(
  eventId: string,
  token: string,
): Promise<ImageUploadInitResponse> {
  return apiPostAuth<ImageUploadInitResponse>(
    `/events/${eventId}/image/upload-url`,
    {},
    token,
  );
}

export async function confirmEventImageUpload(
  eventId: string,
  confirmToken: string,
  token: string,
): Promise<void> {
  return apiPostAuth<void>(
    `/events/${eventId}/image/confirm`,
    { confirm_token: confirmToken },
    token,
  );
}

export async function uploadFileToPresignedUrl(
  method: string,
  url: string,
  headers: Record<string, string>,
  fileUri: string,
): Promise<void> {
  const normalizedMethod = method.toUpperCase();
  if (
    normalizedMethod !== 'POST'
    && normalizedMethod !== 'PUT'
    && normalizedMethod !== 'PATCH'
  ) {
    throw new Error(`Unsupported upload method: ${method}`);
  }

  const uploadResponse = await FileSystem.uploadAsync(url, fileUri, {
    httpMethod: normalizedMethod as SupportedUploadMethod,
    headers,
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });

  if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
    throw new Error(`Upload failed with status ${uploadResponse.status}`);
  }
}

export async function listEvents(
  query: ListEventsQuery,
  token: string,
): Promise<PaginatedEventsResponse> {
  const params = new URLSearchParams();

  params.set('lat', String(query.lat));
  params.set('lon', String(query.lon));

  if (query.radius_meters != null) {
    params.set('radius_meters', String(query.radius_meters));
  }

  if (query.q?.trim()) {
    params.set('q', query.q.trim());
  }


  appendArrayParam(params, 'privacy_levels', query.privacy_levels);
  appendArrayParam(params, 'category_ids', query.category_ids);
  appendArrayParam(params, 'tag_names', query.tag_names);


  if (query.start_from) {
    params.set('start_from', query.start_from);
  }

  if (query.start_to) {
    params.set('start_to', query.start_to);
  }

  if (query.only_favorited != null) {
    params.set('only_favorited', String(query.only_favorited));
  }

  if (query.sort_by) {
    params.set('sort_by', query.sort_by);
  }

  if (query.limit != null) {
    params.set('limit', String(query.limit));
  }

  if (query.cursor) {
    params.set('cursor', query.cursor);
  }

  return apiGetAuth<PaginatedEventsResponse>(`/events?${params.toString()}`, token);
}

function normalizeMyEventStatus(value: string): MyEventStatus | null {
  if (
    value === 'ACTIVE'
    || value === 'IN_PROGRESS'
    || value === 'COMPLETED'
    || value === 'CANCELED'
  ) {
    return value;
  }

  return null;
}

function normalizeOptionalDateTime(value?: string | null): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  // Backend profile event summaries currently serialize a zero time when end_time is absent.
  if (parsed.getUTCFullYear() <= 1) {
    return null;
  }

  return value;
}

function mapToMyEventSummary(
  summary: BackendEventSummary,
  relation: MyEventRelation,
): MyEventSummary | null {
  const status = normalizeMyEventStatus(summary.status);
  if (!status) return null;

  return {
    id: summary.id,
    title: summary.title,
    image_url: summary.image_url ?? null,
    start_time: summary.start_time,
    end_time: normalizeOptionalDateTime(summary.end_time),
    location_address: summary.location_address ?? null,
    approved_participant_count: summary.participants_count ?? null,
    status,
    relation,
    badges: relation === 'HOSTING' ? [{ type: 'HOST', label: 'Host' }] : [],
  };
}

export async function listMyEvents(token: string): Promise<MyEventsResponse> {
  const [hostedResponse, upcomingResponse, completedResponse, canceledResponse] =
    await Promise.all([
      apiGetAuth<BackendEventsListResponse>('/me/events/hosted', token),
      apiGetAuth<BackendEventsListResponse>('/me/events/upcoming', token),
      apiGetAuth<BackendEventsListResponse>('/me/events/completed', token),
      apiGetAuth<BackendEventsListResponse>('/me/events/canceled', token),
    ]);

  const hostedEvents = (hostedResponse.events ?? [])
    .map((event) => mapToMyEventSummary(event, 'HOSTING'))
    .filter((event): event is MyEventSummary => event != null);

  const hostedEventIds = new Set(hostedEvents.map((event) => event.id));

  const attendedSources = [
    ...(upcomingResponse.events ?? []),
    ...(completedResponse.events ?? []),
    ...(canceledResponse.events ?? []),
  ];

  const attendedEvents = attendedSources
    .filter((event) => !hostedEventIds.has(event.id))
    .map((event) => mapToMyEventSummary(event, 'ATTENDING'))
    .filter((event): event is MyEventSummary => event != null);

  return {
    hosted_events: hostedEvents,
    attended_events: attendedEvents,
  };
}
