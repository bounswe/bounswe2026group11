export type CommentType = 'DISCUSSION' | 'REVIEW';

export interface CommentUser {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

export interface EventComment {
  id: string;
  event_id: string;
  user: CommentUser;
  comment_type: CommentType;
  message: string;
  parent_id?: string | null;
  rating?: number | null;
  image_url?: string | null;
  likes_count: number;
  reply_count: number;
  created_at: string;
  updated_at: string;
}

export interface CommentPageInfo {
  next_cursor?: string | null;
  has_next: boolean;
}

export interface CommentCollection {
  items: EventComment[];
  page_info: CommentPageInfo;
}

export interface EventCommentsResponse {
  discussion_comments: CommentCollection;
  review_comments: CommentCollection;
}

export interface CreateDiscussionCommentRequest {
  message: string;
  parent_id?: string | null;
}

export interface UpsertReviewCommentRequest {
  message: string;
  rating: number;
  image_confirm_token?: string | null;
}

export interface ListEventCommentsParams {
  discussion_limit?: number;
  discussion_cursor?: string | null;
  review_limit?: number;
  review_cursor?: string | null;
}

export interface ListCommentRepliesParams {
  limit?: number;
  cursor?: string | null;
}
