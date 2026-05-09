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
  ApproveJoinRequestResponse,
  RejectJoinRequestResponse,
  FavoriteEventsResponse,
  FavoriteEventItem,
  EventApprovedParticipantsResponse,
  EventPendingJoinRequestsResponse,
  EventInvitationsResponse,
  RatingWriteRequest,
  RatingResponse,
  EventCommentsResponse,
  EventCommentCollection,
  EventComment,
  ListEventCommentsParams,
  ListEventCommentRepliesParams,
  CreateDiscussionCommentRequest,
  UpsertReviewCommentRequest,
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

export function listEventComments(
  eventId: string,
  token: string | null,
  params: ListEventCommentsParams = {},
): Promise<EventCommentsResponse> {
  const qs = new URLSearchParams();
  if (params.discussion_limit != null) qs.set('discussion_limit', String(params.discussion_limit));
  if (params.discussion_cursor) qs.set('discussion_cursor', params.discussion_cursor);
  if (params.review_limit != null) qs.set('review_limit', String(params.review_limit));
  if (params.review_cursor) qs.set('review_cursor', params.review_cursor);
  const query = qs.toString();
  const path = query === ''
    ? `/events/${eventId}/comments`
    : `/events/${eventId}/comments?${query}`;
  if (token) {
    return apiGetAuth<EventCommentsResponse>(path, token);
  }
  return apiGet<EventCommentsResponse>(path);
}

export function listEventCommentReplies(
  eventId: string,
  commentId: string,
  token: string | null,
  params: ListEventCommentRepliesParams = {},
): Promise<EventCommentCollection> {
  const qs = new URLSearchParams();
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.cursor) qs.set('cursor', params.cursor);
  const query = qs.toString();
  const path = query === ''
    ? `/events/${eventId}/comments/${commentId}/replies`
    : `/events/${eventId}/comments/${commentId}/replies?${query}`;
  if (token) {
    return apiGetAuth<EventCommentCollection>(path, token);
  }
  return apiGet<EventCommentCollection>(path);
}

export function createDiscussionComment(
  eventId: string,
  body: CreateDiscussionCommentRequest,
  token: string,
): Promise<EventComment> {
  return apiPostAuth<EventComment>(`/events/${eventId}/comments`, body, token);
}

export function upsertReviewComment(
  eventId: string,
  body: UpsertReviewCommentRequest,
  token: string,
): Promise<EventComment> {
  return apiPostAuth<EventComment>(`/events/${eventId}/review-comments`, body, token);
}

export function getReviewCommentImageUploadUrl(
  eventId: string,
  token: string,
): Promise<ImageUploadInitResponse> {
  return apiPostAuth<ImageUploadInitResponse>(
    `/events/${eventId}/review-comments/image/upload-url`,
    {},
    token,
  );
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
