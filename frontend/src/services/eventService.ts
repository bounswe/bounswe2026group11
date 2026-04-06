import { apiDeleteAuth, apiPostAuth, apiPatchAuth, apiGet, apiGetAuth, apiPutAuth } from './api';
import type { ImageUploadConfirmRequest, ImageUploadInitResponse } from '@/models/profile';
import {
  CreateEventRequest,
  CreateEventResponse,
  ListCategoriesResponse,
  LocationSuggestion,
  DiscoverEventsParams,
  DiscoverEventsResponse,
  EventDetailResponse,
  JoinEventResponse,
  JoinRequestResponse,
  ApproveJoinRequestResponse,
  RejectJoinRequestResponse,
  FavoriteEventsResponse,
  FavoriteEventItem,
  RatingWriteRequest,
  RatingResponse,
} from '@/models/event';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

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

export function requestJoinEvent(
  eventId: string,
  token: string,
  message?: string,
): Promise<JoinRequestResponse> {
  return apiPostAuth<JoinRequestResponse>(
    `/events/${eventId}/join-request`,
    message ? { message } : {},
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

export async function getFavoriteEvents(token: string): Promise<FavoriteEventItem[]> {
  const res = await apiGetAuth<FavoriteEventsResponse>('/me/favorites', token);
  return res.items ?? [];
}

export async function searchLocation(
  query: string,
): Promise<LocationSuggestion[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
  });
  const response = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: { 'User-Agent': 'SocialEventMapper/1.0' },
  });
  if (!response.ok) return [];
  return response.json();
}
