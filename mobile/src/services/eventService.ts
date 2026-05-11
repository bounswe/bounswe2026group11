import { apiGet, apiGetAuth, apiPostAuth, apiPatchAuth, apiPutAuth, apiDeleteAuth } from '@/services/api';
import * as FileSystem from 'expo-file-system/legacy';
import {
  PrivacyLevel,
  CreateEventRequest,
  CreateEventResponse,
  UpdateEventRequest,
  UpdateEventResponse,
  EventDetail,
  EventHostContextSummary,
  JoinEventResponse,
  LeaveEventResponse,
  LocationSuggestion,
  ListEventsQuery,
  ListCategoriesResponse,
  MyEventRelation,
  MyEventStatus,
  type MyEventSummary,
  type MyEventsResponse,
  PaginatedEventsResponse,
  RequestJoinRequest,
  RequestJoinResponse,
  ReconfirmParticipationResponse,
  ImageUploadInitResponse,
  EventApprovedParticipantsResponse,
  EventPendingJoinRequestsResponse,
  EventInvitationsResponse,
  RatingWriteRequest,
  RatingResponse,
  EventReportCategory,
  RequestReportEvent,
  ReportEventResponse,
} from '@/models/event';
import { shouldShowProfileEvent } from '@/utils/eventStatus';


const PHOTON_BASE = 'https://photon.komoot.io';
type SupportedUploadMethod = 'POST' | 'PUT' | 'PATCH';

interface PhotonProperties {
  name?: string;
  street?: string;
  housenumber?: string;
  district?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: PhotonProperties;
}

function buildPhotonDisplayName(props: PhotonProperties): string {
  const parts = [
    [props.name, props.street && props.housenumber ? `${props.street} ${props.housenumber}` : props.street].filter(Boolean).join(' '),
    props.district,
    props.city,
    props.state,
    props.country,
  ];

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const part of parts) {
    const value = (part ?? '').trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(value);
  }
  return deduped.join(', ');
}

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
  privacy_level: PrivacyLevel;
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

export async function updateEvent(
  id: string,
  request: UpdateEventRequest,
  token: string,
): Promise<UpdateEventResponse> {
  return apiPatchAuth<UpdateEventResponse>(`/events/${id}`, request, token);
}

export async function getEventDetail(
  id: string,
  token: string,
): Promise<EventDetail> {
  return apiGetAuth<EventDetail>(`/events/${id}`, token);
}

function buildCollectionPath(id: string, resource: string, limit?: number, cursor?: string | null) {
  const params = new URLSearchParams();
  if (limit != null) params.set('limit', String(limit));
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  return query === '' ? `/events/${id}/${resource}` : `/events/${id}/${resource}?${query}`;
}

export async function getEventHostContextSummary(
  id: string,
  token: string,
): Promise<EventHostContextSummary> {
  return apiGetAuth<EventHostContextSummary>(`/events/${id}/host-context`, token);
}

export async function listEventApprovedParticipants(
  id: string,
  token: string,
  options: { limit?: number; cursor?: string | null } = {},
): Promise<EventApprovedParticipantsResponse> {
  return apiGetAuth<EventApprovedParticipantsResponse>(
    buildCollectionPath(id, 'participants', options.limit, options.cursor),
    token,
  );
}

export async function listEventPendingJoinRequests(
  id: string,
  token: string,
  options: { limit?: number; cursor?: string | null } = {},
): Promise<EventPendingJoinRequestsResponse> {
  return apiGetAuth<EventPendingJoinRequestsResponse>(
    buildCollectionPath(id, 'join-requests', options.limit, options.cursor),
    token,
  );
}

export async function listEventInvitations(
  id: string,
  token: string,
  options: { limit?: number; cursor?: string | null } = {},
): Promise<EventInvitationsResponse> {
  return apiGetAuth<EventInvitationsResponse>(
    buildCollectionPath(id, 'invitations', options.limit, options.cursor),
    token,
  );
}

export async function createEventInvitations(
  id: string,
  usernames: string[],
  token: string,
  message?: string,
): Promise<any> {
  return apiPostAuth<any>(`/events/${id}/invitations`, { usernames, message }, token);
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

export async function withdrawJoinRequest(
  eventId: string,
  token: string,
): Promise<void> {
  return apiDeleteAuth<void>(`/events/${eventId}/join-requests/me`, token);
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

export async function reconfirmEventParticipation(
  eventId: string,
  token: string,
): Promise<ReconfirmParticipationResponse> {
  return apiPostAuth<ReconfirmParticipationResponse>(
    `/events/${eventId}/participation/reconfirm`,
    {},
    token,
  );
}

export async function cancelEvent(
  eventId: string,
  token: string,
): Promise<any> {
  return apiPatchAuth<any>(`/events/${eventId}/cancel`, {}, token);
}

export async function upsertEventRating(
  eventId: string,
  request: RatingWriteRequest,
  token: string,
): Promise<RatingResponse> {
  return apiPutAuth<RatingResponse>(`/events/${eventId}/rating`, request, token);
}

export async function upsertParticipantRating(
  eventId: string,
  participantUserId: string,
  request: RatingWriteRequest,
  token: string,
): Promise<RatingResponse> {
  return apiPutAuth<RatingResponse>(
    `/events/${eventId}/participants/${participantUserId}/rating`,
    request,
    token,
  );
}

export async function searchLocation(
  query: string,
): Promise<LocationSuggestion[]> {
  if (query.trim().length < 2) return [];

  const params = new URLSearchParams({
    q: query,
    limit: '5',
    lang: 'en',
  });

  let response: Response;
  try {
    response = await fetch(`${PHOTON_BASE}/api?${params}`);
  } catch {
    return [];
  }

  if (!response.ok) return [];

  const data = await response.json().catch(() => null);
  if (!data || !Array.isArray(data.features)) return [];

  return (data.features as PhotonFeature[])
    .map((feature): LocationSuggestion | null => {
      const coords = feature.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return null;
      const [lon, lat] = coords;
      if (typeof lon !== 'number' || typeof lat !== 'number') return null;

      const displayName = buildPhotonDisplayName(feature.properties ?? {});
      if (!displayName) return null;

      return {
        display_name: displayName,
        lat: String(lat),
        lon: String(lon),
      };
    })
    .filter((s): s is LocationSuggestion => s !== null);
}

export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<LocationSuggestion | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    lang: 'en',
  });

  let response: Response;
  try {
    response = await fetch(`${PHOTON_BASE}/reverse?${params}`);
  } catch {
    return null;
  }

  if (!response.ok) return null;

  const data = await response.json().catch(() => null);
  if (!data || !Array.isArray(data.features) || data.features.length === 0) return null;

  const feature = data.features[0] as PhotonFeature;
  const coords = feature.geometry?.coordinates;
  // Prefer the original tap coordinates so the marker stays where the user tapped,
  // even if Photon snaps the result to a nearby road or POI.
  const resolvedLat = Array.isArray(coords) && typeof coords[1] === 'number' ? coords[1] : lat;
  const resolvedLon = Array.isArray(coords) && typeof coords[0] === 'number' ? coords[0] : lon;
  const displayName = buildPhotonDisplayName(feature.properties ?? {});
  if (!displayName) return null;

  return {
    display_name: displayName,
    lat: String(resolvedLat),
    lon: String(resolvedLon),
  };
}

const OSRM_BASE = 'https://router.project-osrm.org';

interface OSRMRoute {
  geometry?: { coordinates?: Array<[number, number]> };
}

interface OSRMResponse {
  code?: string;
  routes?: OSRMRoute[];
}

/**
 * Fetches a routed geometry that follows the road network between the given
 * waypoints (in order). Uses OSRM's public driving profile — keyless and free,
 * but rate-limited and not for production-grade traffic. Returns null on any
 * failure so callers can fall back to a straight polyline.
 */
export async function fetchRoutedGeometry(
  waypoints: Array<{ lat: number; lon: number }>,
): Promise<Array<{ lat: number; lon: number }> | null> {
  if (waypoints.length < 2) return null;
  if (waypoints.some((p) => !Number.isFinite(p.lat) || !Number.isFinite(p.lon))) {
    return null;
  }

  const coords = waypoints.map((p) => `${p.lon},${p.lat}`).join(';');
  const url =
    `${OSRM_BASE}/route/v1/driving/${coords}` +
    `?overview=full&geometries=geojson`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const data = (await response.json().catch(() => null)) as OSRMResponse | null;
  if (!data || data.code !== 'Ok') return null;
  const geom = data.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(geom) || geom.length < 2) return null;

  const points: Array<{ lat: number; lon: number }> = [];
  for (const pair of geom) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const [lon, lat] = pair;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    points.push({ lat, lon });
  }
  return points.length >= 2 ? points : null;
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

export async function getJoinRequestImageUploadUrl(
  eventId: string,
  token: string,
): Promise<ImageUploadInitResponse> {
  return apiPostAuth<ImageUploadInitResponse>(
    `/events/${eventId}/join-request/image/upload-url`,
    {},
    token,
  );
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

  if (query.child_friendly != null) {
    params.set('child_friendly', String(query.child_friendly));
  }

  if (query.family_oriented != null) {
    params.set('family_oriented', String(query.family_oriented));
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
    privacy_level: summary.privacy_level,
    badges: relation === 'HOSTING' ? [{ type: 'HOST', label: 'Host' }] : [],
  };
}

export async function listMyEvents(token: string): Promise<MyEventsResponse> {
  const withTimeout = <T>(promise: Promise<T>, timeoutMs = 10000): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), timeoutMs)
      ),
    ]);
  };

  const [hostedResponse, upcomingResponse, completedResponse, canceledResponse] =
    await Promise.all([
      withTimeout(apiGetAuth<BackendEventsListResponse>('/me/events/hosted', token)).catch(() => ({ events: [] })),
      withTimeout(apiGetAuth<BackendEventsListResponse>('/me/events/upcoming', token)).catch(() => ({ events: [] })),
      withTimeout(apiGetAuth<BackendEventsListResponse>('/me/events/completed', token)).catch(() => ({ events: [] })),
      withTimeout(apiGetAuth<BackendEventsListResponse>('/me/events/canceled', token)).catch(() => ({ events: [] })),
    ]);

  const hostedEvents = (hostedResponse?.events ?? [])
    .map((event) => mapToMyEventSummary(event, 'HOSTING'))
    .filter((event): event is MyEventSummary => event != null);

  const hostedEventIds = new Set(hostedEvents.map((event) => event.id));

  const attendedSources = [
    ...(upcomingResponse?.events ?? []),
    ...(completedResponse?.events ?? []),
    ...(canceledResponse?.events ?? []),
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

export async function reportEvent(
  id: string,
  body: RequestReportEvent,
  token: string,
): Promise<ReportEventResponse> {
  return apiPostAuth<ReportEventResponse>(`/events/${id}/reports`, body, token);
}

export async function getEventReportImageUploadUrl(
  eventId: string,
  token: string,
): Promise<ImageUploadInitResponse> {
  return apiPostAuth<ImageUploadInitResponse>(
    `/events/${eventId}/reports/image/upload-url`,
    {},
    token,
  );
}
