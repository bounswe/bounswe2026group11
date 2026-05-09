import { apiDeleteAuth, apiPostAuth, apiPatchAuth, apiGet, apiGetAuth, apiPutAuth } from './api';
import type { ImageUploadConfirmRequest, ImageUploadInitResponse } from '@/models/profile';
import type {
  CreateEventInvitationsRequest,
  CreateEventInvitationsResponse,
} from '@/models/invitation';
import {
  CreateEventRequest,
  CreateEventResponse,
  ListCategoriesResponse,
  LocationSuggestion,
  DiscoverEventsParams,
  DiscoverEventsResponse,
  EventDetailResponse,
  EventHostContextSummary,
  JoinEventResponse,
  JoinRequestResponse,
  RequestJoinRequestBody,
  ApproveJoinRequestResponse,
  RejectJoinRequestResponse,
  FavoriteEventsResponse,
  FavoriteEventItem,
  EventApprovedParticipantsResponse,
  EventPendingJoinRequestsResponse,
  EventInvitationsResponse,
  RatingWriteRequest,
  RatingResponse,
} from '@/models/event';

const PHOTON_BASE = 'https://photon.komoot.io';

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
  const street = props.street && props.housenumber
    ? `${props.street} ${props.housenumber}`
    : props.street;
  const headline = [props.name, street].filter(Boolean).join(' ');

  const parts = [headline, props.district, props.city, props.state, props.country];

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

export function createEvent(
  request: CreateEventRequest,
  token: string,
): Promise<CreateEventResponse> {
  return apiPostAuth<CreateEventResponse>('/events/', request, token);
}

export function listCategories(): Promise<ListCategoriesResponse> {
  return apiGet<ListCategoriesResponse>('/categories/');
}

export function discoverEvents(
  params: DiscoverEventsParams,
  token: string | null,
): Promise<DiscoverEventsResponse> {
  const qs = new URLSearchParams();
  qs.set('lat', String(params.lat));
  qs.set('lon', String(params.lon));
  if (params.radius_meters != null) qs.set('radius_meters', String(params.radius_meters));
  if (params.q) qs.set('q', params.q);
  if (params.privacy_levels) qs.set('privacy_levels', params.privacy_levels);
  if (params.category_ids) qs.set('category_ids', params.category_ids);
  if (params.start_from) qs.set('start_from', params.start_from);
  if (params.start_to) qs.set('start_to', params.start_to);
  if (params.tag_names) qs.set('tag_names', params.tag_names);
  if (params.only_favorited) qs.set('only_favorited', 'true');
  if (params.sort_by) qs.set('sort_by', params.sort_by);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.cursor) qs.set('cursor', params.cursor);
  const path = `/events/?${qs}`;
  if (token) {
    return apiGetAuth<DiscoverEventsResponse>(path, token);
  }
  return apiGet<DiscoverEventsResponse>(path);
}

export function getEventDetail(
  eventId: string,
  token: string | null,
): Promise<EventDetailResponse> {
  if (token) {
    return apiGetAuth<EventDetailResponse>(`/events/${eventId}`, token);
  }
  return apiGet<EventDetailResponse>(`/events/${eventId}`);
}

function buildCollectionPath(eventId: string, resource: string, limit?: number, cursor?: string | null) {
  const qs = new URLSearchParams();
  if (limit != null) qs.set('limit', String(limit));
  if (cursor) qs.set('cursor', cursor);
  const query = qs.toString();
  return query === '' ? `/events/${eventId}/${resource}` : `/events/${eventId}/${resource}?${query}`;
}

export function getEventHostContextSummary(
  eventId: string,
  token: string,
): Promise<EventHostContextSummary> {
  return apiGetAuth<EventHostContextSummary>(`/events/${eventId}/host-context`, token);
}

export function listEventApprovedParticipants(
  eventId: string,
  token: string,
  options: { limit?: number; cursor?: string | null } = {},
): Promise<EventApprovedParticipantsResponse> {
  return apiGetAuth<EventApprovedParticipantsResponse>(
    buildCollectionPath(eventId, 'participants', options.limit, options.cursor),
    token,
  );
}

export function listEventPendingJoinRequests(
  eventId: string,
  token: string,
  options: { limit?: number; cursor?: string | null } = {},
): Promise<EventPendingJoinRequestsResponse> {
  return apiGetAuth<EventPendingJoinRequestsResponse>(
    buildCollectionPath(eventId, 'join-requests', options.limit, options.cursor),
    token,
  );
}

export function listEventInvitations(
  eventId: string,
  token: string,
  options: { limit?: number; cursor?: string | null } = {},
): Promise<EventInvitationsResponse> {
  return apiGetAuth<EventInvitationsResponse>(
    buildCollectionPath(eventId, 'invitations', options.limit, options.cursor),
    token,
  );
}

export function createEventInvitations(
  eventId: string,
  body: CreateEventInvitationsRequest,
  token: string,
): Promise<CreateEventInvitationsResponse> {
  return apiPostAuth<CreateEventInvitationsResponse>(
    `/events/${eventId}/invitations`,
    body,
    token,
  );
}

export function getEventImageUploadUrl(
  eventId: string,
  token: string,
): Promise<ImageUploadInitResponse> {
  return apiPostAuth<ImageUploadInitResponse>(`/events/${eventId}/image/upload-url`, {}, token);
}

export function confirmEventImageUpload(
  eventId: string,
  body: ImageUploadConfirmRequest,
  token: string,
): Promise<void> {
  return apiPostAuth<void>(`/events/${eventId}/image/confirm`, body, token);
}

export function joinEvent(
  eventId: string,
  token: string,
): Promise<JoinEventResponse> {
  return apiPostAuth<JoinEventResponse>(`/events/${eventId}/join`, {}, token);
}

export function leaveEvent(
  eventId: string,
  token: string,
): Promise<void> {
  return apiPatchAuth<void>(`/events/${eventId}/leave`, {}, token);
}

export function requestJoinEvent(
  eventId: string,
  token: string,
  body: RequestJoinRequestBody = {},
): Promise<JoinRequestResponse> {
  const payload: Record<string, string> = {};
  if (body.message) payload.message = body.message;
  if (body.image_confirm_token) payload.image_confirm_token = body.image_confirm_token;
  return apiPostAuth<JoinRequestResponse>(
    `/events/${eventId}/join-request`,
    payload,
    token,
  );
}

export function getJoinRequestImageUploadUrl(
  eventId: string,
  token: string,
): Promise<ImageUploadInitResponse> {
  return apiPostAuth<ImageUploadInitResponse>(
    `/events/${eventId}/join-request/image/upload-url`,
    {},
    token,
  );
}

export function approveJoinRequest(
  eventId: string,
  joinRequestId: string,
  token: string,
): Promise<ApproveJoinRequestResponse> {
  return apiPostAuth<ApproveJoinRequestResponse>(
    `/events/${eventId}/join-requests/${joinRequestId}/approve`,
    {},
    token,
  );
}

export function rejectJoinRequest(
  eventId: string,
  joinRequestId: string,
  token: string,
): Promise<RejectJoinRequestResponse> {
  return apiPostAuth<RejectJoinRequestResponse>(
    `/events/${eventId}/join-requests/${joinRequestId}/reject`,
    {},
    token,
  );
}

export function cancelEvent(
  eventId: string,
  token: string,
): Promise<void> {
  return apiPatchAuth<void>(`/events/${eventId}/cancel`, {}, token);
}

export function upsertEventRating(
  eventId: string,
  request: RatingWriteRequest,
  token: string,
): Promise<RatingResponse> {
  return apiPutAuth<RatingResponse>(`/events/${eventId}/rating`, request, token);
}

export function deleteEventRating(
  eventId: string,
  token: string,
): Promise<void> {
  return apiDeleteAuth<void>(`/events/${eventId}/rating`, token);
}

export function upsertParticipantRating(
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

export function deleteParticipantRating(
  eventId: string,
  participantUserId: string,
  token: string,
): Promise<void> {
  return apiDeleteAuth<void>(`/events/${eventId}/participants/${participantUserId}/rating`, token);
}

export function addFavorite(eventId: string, token: string): Promise<void> {
  return apiPostAuth<void>(`/events/${eventId}/favorite`, {}, token);
}

export function removeFavorite(eventId: string, token: string): Promise<void> {
  return apiDeleteAuth<void>(`/events/${eventId}/favorite`, token);
}

export async function getFavoriteEvents(token: string): Promise<FavoriteEventItem[]> {
  const res = await apiGetAuth<FavoriteEventsResponse>('/me/favorites', token);
  return res.items ?? [];
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
  // Prefer the original coordinates so a map-tap marker stays where the user
  // tapped, even if Photon snaps the result to a nearby road or POI.
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
