import { apiGet, apiGetAuth, apiPostAuth } from '@/services/api';
import {
  EventCommentsResponse,
  CommentCollection,
  EventComment,
  CreateDiscussionCommentRequest,
  UpsertReviewCommentRequest,
  ListEventCommentsParams,
  ListCommentRepliesParams,
} from '@/models/comment';

function buildCommentsPath(eventId: string, params: ListEventCommentsParams): string {
  const p = new URLSearchParams();
  if (params.discussion_limit != null) p.set('discussion_limit', String(params.discussion_limit));
  if (params.discussion_cursor) p.set('discussion_cursor', params.discussion_cursor);
  if (params.review_limit != null) p.set('review_limit', String(params.review_limit));
  if (params.review_cursor) p.set('review_cursor', params.review_cursor);
  const query = p.toString();
  return query ? `/events/${eventId}/comments?${query}` : `/events/${eventId}/comments`;
}

function buildRepliesPath(eventId: string, commentId: string, params: ListCommentRepliesParams): string {
  const p = new URLSearchParams();
  if (params.limit != null) p.set('limit', String(params.limit));
  if (params.cursor) p.set('cursor', params.cursor);
  const query = p.toString();
  const base = `/events/${eventId}/comments/${commentId}/replies`;
  return query ? `${base}?${query}` : base;
}

export async function listEventComments(
  eventId: string,
  params: ListEventCommentsParams = {},
  token?: string,
): Promise<EventCommentsResponse> {
  const path = buildCommentsPath(eventId, params);
  if (token) {
    return apiGetAuth<EventCommentsResponse>(path, token);
  }
  return apiGet<EventCommentsResponse>(path);
}

export async function listCommentReplies(
  eventId: string,
  commentId: string,
  params: ListCommentRepliesParams = {},
  token?: string,
): Promise<CommentCollection> {
  const path = buildRepliesPath(eventId, commentId, params);
  if (token) {
    return apiGetAuth<CommentCollection>(path, token);
  }
  return apiGet<CommentCollection>(path);
}

export async function createDiscussionComment(
  eventId: string,
  body: CreateDiscussionCommentRequest,
  token: string,
): Promise<EventComment> {
  return apiPostAuth<EventComment>(`/events/${eventId}/comments`, body, token);
}

export async function upsertReviewComment(
  eventId: string,
  body: UpsertReviewCommentRequest,
  token: string,
): Promise<EventComment> {
  return apiPostAuth<EventComment>(`/events/${eventId}/review-comments`, body, token);
}
