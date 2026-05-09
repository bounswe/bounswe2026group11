import { useCallback, useEffect, useRef, useState } from 'react';
import { EventComment, CommentCollection } from '@/models/comment';
import {
  listEventComments,
  listCommentReplies,
  createDiscussionComment,
  upsertReviewComment,
} from '@/services/commentService';
import { ApiError } from '@/services/api';

const PAGE_SIZE = 25;

export interface DiscussionState {
  items: EventComment[];
  nextCursor: string | null;
  hasNext: boolean;
  loading: boolean;
}

export interface RepliesState {
  items: EventComment[];
  nextCursor: string | null;
  hasNext: boolean;
  loading: boolean;
}

export interface EventDiscussionViewModel {
  discussions: DiscussionState;
  reviews: DiscussionState;
  repliesMap: Record<string, RepliesState>;

  newDiscussionMessage: string;
  setNewDiscussionMessage: (v: string) => void;
  replyingToId: string | null;
  setReplyingToId: (id: string | null) => void;
  replyMessage: string;
  setReplyMessage: (v: string) => void;

  newReviewMessage: string;
  setNewReviewMessage: (v: string) => void;
  newReviewRating: number;
  setNewReviewRating: (v: number) => void;

  discussionSubmitting: boolean;
  discussionError: string | null;
  reviewSubmitting: boolean;
  reviewError: string | null;

  loadMoreDiscussions: () => Promise<void>;
  loadMoreReviews: () => Promise<void>;
  loadReplies: (parentId: string) => Promise<void>;
  loadMoreReplies: (parentId: string) => Promise<void>;

  submitDiscussionComment: () => Promise<void>;
  submitReply: (parentId: string) => Promise<void>;
  submitReview: () => Promise<void>;

  dismissDiscussionError: () => void;
  dismissReviewError: () => void;

  refresh: () => void;
}

function makeEmptyDiscussionState(): DiscussionState {
  return { items: [], nextCursor: null, hasNext: false, loading: false };
}

function mapCommentError(err: ApiError, fallback: string): string {
  const map: Record<string, string> = {
    comments_not_allowed: 'Comments are not available for this event.',
    comment_write_not_allowed: 'You cannot post comments on this event.',
    comment_not_found: 'The comment you are replying to was not found.',
    reviews_not_allowed: 'You are not eligible to review this event.',
    host_cannot_rate_self: 'Hosts cannot review their own event.',
  };

  if (err.code === 'validation_error') {
    const detail = err.details?.message ?? err.details?.rating;
    return detail ?? err.message ?? fallback;
  }

  return map[err.code] ?? err.message ?? fallback;
}

export function useEventDiscussionViewModel(
  eventId: string,
  token?: string,
): EventDiscussionViewModel {
  const [discussions, setDiscussions] = useState<DiscussionState>(makeEmptyDiscussionState());
  const [reviews, setReviews] = useState<DiscussionState>(makeEmptyDiscussionState());
  const [repliesMap, setRepliesMap] = useState<Record<string, RepliesState>>({});

  const [newDiscussionMessage, setNewDiscussionMessage] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');

  const [newReviewMessage, setNewReviewMessage] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(0);

  const [discussionSubmitting, setDiscussionSubmitting] = useState(false);
  const [discussionError, setDiscussionError] = useState<string | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const loadedRef = useRef(false);

  const loadInitial = useCallback(async () => {
    setDiscussions((prev) => ({ ...prev, loading: true }));
    setReviews((prev) => ({ ...prev, loading: true }));
    try {
      const resp = await listEventComments(
        eventId,
        { discussion_limit: PAGE_SIZE, review_limit: PAGE_SIZE },
        token,
      );
      setDiscussions({
        items: resp.discussion_comments.items,
        nextCursor: resp.discussion_comments.page_info.next_cursor ?? null,
        hasNext: resp.discussion_comments.page_info.has_next,
        loading: false,
      });
      setReviews({
        items: resp.review_comments.items,
        nextCursor: resp.review_comments.page_info.next_cursor ?? null,
        hasNext: resp.review_comments.page_info.has_next,
        loading: false,
      });
    } catch {
      setDiscussions((prev) => ({ ...prev, loading: false }));
      setReviews((prev) => ({ ...prev, loading: false }));
    }
  }, [eventId, token]);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      void loadInitial();
    }
  }, [loadInitial]);

  const refresh = useCallback(() => {
    loadedRef.current = false;
    setDiscussions(makeEmptyDiscussionState());
    setReviews(makeEmptyDiscussionState());
    setRepliesMap({});
    loadedRef.current = true;
    void loadInitial();
  }, [loadInitial]);

  const loadMoreDiscussions = useCallback(async () => {
    if (!discussions.hasNext || !discussions.nextCursor || discussions.loading) return;
    setDiscussions((prev) => ({ ...prev, loading: true }));
    try {
      const resp = await listEventComments(
        eventId,
        { discussion_limit: PAGE_SIZE, discussion_cursor: discussions.nextCursor },
        token,
      );
      setDiscussions((prev) => ({
        items: [...prev.items, ...resp.discussion_comments.items],
        nextCursor: resp.discussion_comments.page_info.next_cursor ?? null,
        hasNext: resp.discussion_comments.page_info.has_next,
        loading: false,
      }));
    } catch {
      setDiscussions((prev) => ({ ...prev, loading: false }));
    }
  }, [eventId, token, discussions.hasNext, discussions.nextCursor, discussions.loading]);

  const loadMoreReviews = useCallback(async () => {
    if (!reviews.hasNext || !reviews.nextCursor || reviews.loading) return;
    setReviews((prev) => ({ ...prev, loading: true }));
    try {
      const resp = await listEventComments(
        eventId,
        { review_limit: PAGE_SIZE, review_cursor: reviews.nextCursor },
        token,
      );
      setReviews((prev) => ({
        items: [...prev.items, ...resp.review_comments.items],
        nextCursor: resp.review_comments.page_info.next_cursor ?? null,
        hasNext: resp.review_comments.page_info.has_next,
        loading: false,
      }));
    } catch {
      setReviews((prev) => ({ ...prev, loading: false }));
    }
  }, [eventId, token, reviews.hasNext, reviews.nextCursor, reviews.loading]);

  const loadReplies = useCallback(async (parentId: string) => {
    setRepliesMap((prev) => ({
      ...prev,
      [parentId]: { items: [], nextCursor: null, hasNext: false, loading: true },
    }));
    try {
      const resp: CommentCollection = await listCommentReplies(
        eventId,
        parentId,
        { limit: PAGE_SIZE },
        token,
      );
      setRepliesMap((prev) => ({
        ...prev,
        [parentId]: {
          items: resp.items,
          nextCursor: resp.page_info.next_cursor ?? null,
          hasNext: resp.page_info.has_next,
          loading: false,
        },
      }));
    } catch {
      setRepliesMap((prev) => ({
        ...prev,
        [parentId]: { items: [], nextCursor: null, hasNext: false, loading: false },
      }));
    }
  }, [eventId, token]);

  const loadMoreReplies = useCallback(async (parentId: string) => {
    const current = repliesMap[parentId];
    if (!current || !current.hasNext || !current.nextCursor || current.loading) return;
    setRepliesMap((prev) => ({ ...prev, [parentId]: { ...prev[parentId], loading: true } }));
    try {
      const resp: CommentCollection = await listCommentReplies(
        eventId,
        parentId,
        { limit: PAGE_SIZE, cursor: current.nextCursor },
        token,
      );
      setRepliesMap((prev) => ({
        ...prev,
        [parentId]: {
          items: [...prev[parentId].items, ...resp.items],
          nextCursor: resp.page_info.next_cursor ?? null,
          hasNext: resp.page_info.has_next,
          loading: false,
        },
      }));
    } catch {
      setRepliesMap((prev) => ({ ...prev, [parentId]: { ...prev[parentId], loading: false } }));
    }
  }, [eventId, token, repliesMap]);

  const submitDiscussionComment = useCallback(async () => {
    if (!token || !newDiscussionMessage.trim()) return;
    setDiscussionSubmitting(true);
    setDiscussionError(null);
    try {
      const comment = await createDiscussionComment(
        eventId,
        { message: newDiscussionMessage.trim() },
        token,
      );
      setDiscussions((prev) => ({
        ...prev,
        items: [comment, ...prev.items],
      }));
      setNewDiscussionMessage('');
    } catch (err) {
      if (err instanceof ApiError) {
        setDiscussionError(mapCommentError(err, 'Failed to post comment. Please try again.'));
      } else {
        setDiscussionError('Failed to post comment. Please try again.');
      }
    } finally {
      setDiscussionSubmitting(false);
    }
  }, [eventId, token, newDiscussionMessage]);

  const submitReply = useCallback(async (parentId: string) => {
    if (!token || !replyMessage.trim()) return;
    setDiscussionSubmitting(true);
    setDiscussionError(null);
    try {
      const comment = await createDiscussionComment(
        eventId,
        { message: replyMessage.trim(), parent_id: parentId },
        token,
      );
      setRepliesMap((prev) => ({
        ...prev,
        [parentId]: {
          ...(prev[parentId] ?? { nextCursor: null, hasNext: false, loading: false }),
          items: [...(prev[parentId]?.items ?? []), comment],
        },
      }));
      setDiscussions((prev) => ({
        ...prev,
        items: prev.items.map((c) =>
          c.id === parentId ? { ...c, reply_count: c.reply_count + 1 } : c,
        ),
      }));
      setReplyMessage('');
      setReplyingToId(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setDiscussionError(mapCommentError(err, 'Failed to post reply. Please try again.'));
      } else {
        setDiscussionError('Failed to post reply. Please try again.');
      }
    } finally {
      setDiscussionSubmitting(false);
    }
  }, [eventId, token, replyMessage]);

  const submitReview = useCallback(async () => {
    if (!token || !newReviewMessage.trim() || newReviewRating < 1) return;
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      const comment = await upsertReviewComment(
        eventId,
        { message: newReviewMessage.trim(), rating: newReviewRating },
        token,
      );
      setReviews((prev) => {
        const existing = prev.items.findIndex((c) => c.user.id === comment.user.id);
        if (existing >= 0) {
          const updated = [...prev.items];
          updated[existing] = comment;
          return { ...prev, items: updated };
        }
        return { ...prev, items: [comment, ...prev.items] };
      });
      setNewReviewMessage('');
      setNewReviewRating(0);
    } catch (err) {
      if (err instanceof ApiError) {
        setReviewError(mapCommentError(err, 'Failed to submit review. Please try again.'));
      } else {
        setReviewError('Failed to submit review. Please try again.');
      }
    } finally {
      setReviewSubmitting(false);
    }
  }, [eventId, token, newReviewMessage, newReviewRating]);

  const dismissDiscussionError = useCallback(() => setDiscussionError(null), []);
  const dismissReviewError = useCallback(() => setReviewError(null), []);

  return {
    discussions,
    reviews,
    repliesMap,
    newDiscussionMessage,
    setNewDiscussionMessage,
    replyingToId,
    setReplyingToId,
    replyMessage,
    setReplyMessage,
    newReviewMessage,
    setNewReviewMessage,
    newReviewRating,
    setNewReviewRating,
    discussionSubmitting,
    discussionError,
    reviewSubmitting,
    reviewError,
    loadMoreDiscussions,
    loadMoreReviews,
    loadReplies,
    loadMoreReplies,
    submitDiscussionComment,
    submitReply,
    submitReview,
    dismissDiscussionError,
    dismissReviewError,
    refresh,
  };
}
