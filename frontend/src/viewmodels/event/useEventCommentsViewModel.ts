import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listEventComments,
  listEventCommentReplies,
  createDiscussionComment,
  upsertReviewComment,
  getReviewCommentImageUploadUrl,
} from '@/services/eventService';
import type {
  EventComment,
  EventCommentCollection,
} from '@/models/event';
import { ApiError } from '@/services/api';
import i18n from '@/i18n';
import { prepareAvatarBlobs } from '@/utils/imageResize';
import { uploadImageVariants } from '@/utils/directImageUpload';

const PAGE_LIMIT = 25;

export type CommentsStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';

export interface RepliesState {
  items: EventComment[];
  loading: boolean;
  error: string | null;
  nextCursor: string | null;
  hasNext: boolean;
  expanded: boolean;
}

interface CursorState {
  next: string | null;
  hasNext: boolean;
}

const EMPTY_CURSOR: CursorState = { next: null, hasNext: false };

function defaultRepliesState(): RepliesState {
  return {
    items: [],
    loading: false,
    error: null,
    nextCursor: null,
    hasNext: false,
    expanded: false,
  };
}

function mapCommentApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const codeMap: Record<string, string> = {
      comments_not_allowed: 'Comments are not available for this event.',
      review_not_allowed: 'You are not eligible to review this event.',
      review_window_closed: 'The review window for this event has closed.',
      discussion_window_closed: 'Discussion is closed for this event.',
      validation_error: err.details?.message ?? err.message,
      not_found: 'Event or comment not found.',
    };
    return codeMap[err.code] ?? err.message ?? fallback;
  }
  return fallback;
}

export function useEventCommentsViewModel(
  eventId: string | undefined,
  token: string | null,
) {
  const [status, setStatus] = useState<CommentsStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [discussionComments, setDiscussionComments] = useState<EventComment[]>([]);
  const [discussionCursor, setDiscussionCursor] = useState<CursorState>(EMPTY_CURSOR);
  const [discussionLoadingMore, setDiscussionLoadingMore] = useState(false);

  const [reviewComments, setReviewComments] = useState<EventComment[]>([]);
  const [reviewCursor, setReviewCursor] = useState<CursorState>(EMPTY_CURSOR);
  const [reviewLoadingMore, setReviewLoadingMore] = useState(false);

  const [repliesByCommentId, setRepliesByCommentId] = useState<Record<string, RepliesState>>({});

  const [discussionSubmitLoading, setDiscussionSubmitLoading] = useState(false);
  const [discussionSubmitError, setDiscussionSubmitError] = useState<string | null>(null);

  const [replySubmitState, setReplySubmitState] = useState<{
    parentId: string | null;
    loading: boolean;
    error: string | null;
  }>({ parentId: null, loading: false, error: null });

  const [reviewSubmitLoading, setReviewSubmitLoading] = useState(false);
  const [reviewSubmitError, setReviewSubmitError] = useState<string | null>(null);
  const [reviewSubmitSuccess, setReviewSubmitSuccess] = useState<string | null>(null);
  const reviewSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (reviewSuccessTimerRef.current) clearTimeout(reviewSuccessTimerRef.current);
    },
    [],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setErrorMessage(null);
    setDiscussionComments([]);
    setDiscussionCursor(EMPTY_CURSOR);
    setReviewComments([]);
    setReviewCursor(EMPTY_CURSOR);
    setRepliesByCommentId({});
    setDiscussionSubmitError(null);
    setReplySubmitState({ parentId: null, loading: false, error: null });
    setReviewSubmitError(null);
    setReviewSubmitSuccess(null);
  }, []);

  const applyResponseCollection = useCallback(
    (
      collection: EventCommentCollection,
      setItems: (items: EventComment[]) => void,
      setCursor: (cursor: CursorState) => void,
    ) => {
      setItems(collection.items);
      setCursor({ next: collection.page_info.next_cursor, hasNext: collection.page_info.has_next });
    },
    [],
  );

  const loadInitial = useCallback(async () => {
    if (!eventId) return;
    setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await listEventComments(eventId, token, {
        discussion_limit: PAGE_LIMIT,
        review_limit: PAGE_LIMIT,
      });
      applyResponseCollection(data.discussion_comments, setDiscussionComments, setDiscussionCursor);
      applyResponseCollection(data.review_comments, setReviewComments, setReviewCursor);
      setStatus('ready');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409 && err.code === 'comments_not_allowed') {
          setStatus('unavailable');
          return;
        }
        if (err.status === 404) {
          setStatus('unavailable');
          return;
        }
      }
      setStatus('error');
      setErrorMessage(mapCommentApiError(err, i18n.t('errors.comments_load_failed')));
    }
  }, [eventId, token, applyResponseCollection]);

  useEffect(() => {
    if (!eventId) {
      reset();
      return;
    }
    void loadInitial();
  }, [eventId, token, loadInitial, reset]);

  const loadMoreDiscussion = useCallback(async () => {
    if (!eventId || !discussionCursor.hasNext || !discussionCursor.next || discussionLoadingMore) {
      return;
    }
    setDiscussionLoadingMore(true);
    try {
      const data = await listEventComments(eventId, token, {
        discussion_limit: PAGE_LIMIT,
        discussion_cursor: discussionCursor.next,
        review_limit: 1,
      });
      setDiscussionComments((prev) => [...prev, ...data.discussion_comments.items]);
      setDiscussionCursor({
        next: data.discussion_comments.page_info.next_cursor,
        hasNext: data.discussion_comments.page_info.has_next,
      });
    } catch (err) {
      setErrorMessage(mapCommentApiError(err, i18n.t('errors.comments_load_discussion_more_failed')));
    } finally {
      setDiscussionLoadingMore(false);
    }
  }, [eventId, token, discussionCursor, discussionLoadingMore]);

  const loadMoreReviews = useCallback(async () => {
    if (!eventId || !reviewCursor.hasNext || !reviewCursor.next || reviewLoadingMore) {
      return;
    }
    setReviewLoadingMore(true);
    try {
      const data = await listEventComments(eventId, token, {
        discussion_limit: 1,
        review_limit: PAGE_LIMIT,
        review_cursor: reviewCursor.next,
      });
      setReviewComments((prev) => [...prev, ...data.review_comments.items]);
      setReviewCursor({
        next: data.review_comments.page_info.next_cursor,
        hasNext: data.review_comments.page_info.has_next,
      });
    } catch (err) {
      setErrorMessage(mapCommentApiError(err, i18n.t('errors.comments_load_reviews_more_failed')));
    } finally {
      setReviewLoadingMore(false);
    }
  }, [eventId, token, reviewCursor, reviewLoadingMore]);

  const updateReplyState = useCallback(
    (commentId: string, updater: (prev: RepliesState) => RepliesState) => {
      setRepliesByCommentId((prev) => {
        const current = prev[commentId] ?? defaultRepliesState();
        return { ...prev, [commentId]: updater(current) };
      });
    },
    [],
  );

  const loadReplies = useCallback(
    async (commentId: string, cursor?: string | null, append = false) => {
      if (!eventId) return;
      updateReplyState(commentId, (prev) => ({ ...prev, loading: true, error: null }));
      try {
        const data = await listEventCommentReplies(eventId, commentId, token, {
          limit: PAGE_LIMIT,
          cursor: cursor ?? undefined,
        });
        updateReplyState(commentId, (prev) => ({
          ...prev,
          items: append ? [...prev.items, ...data.items] : data.items,
          loading: false,
          error: null,
          nextCursor: data.page_info.next_cursor,
          hasNext: data.page_info.has_next,
          expanded: true,
        }));
      } catch (err) {
        updateReplyState(commentId, (prev) => ({
          ...prev,
          loading: false,
          error: mapCommentApiError(err, i18n.t('errors.comments_load_replies_failed')),
        }));
      }
    },
    [eventId, token, updateReplyState],
  );

  const toggleReplies = useCallback(
    async (comment: EventComment) => {
      const existing = repliesByCommentId[comment.id];
      if (existing && existing.expanded) {
        updateReplyState(comment.id, (prev) => ({ ...prev, expanded: false }));
        return;
      }
      if (existing && existing.items.length > 0) {
        updateReplyState(comment.id, (prev) => ({ ...prev, expanded: true }));
        return;
      }
      if (comment.reply_count === 0) {
        updateReplyState(comment.id, (prev) => ({ ...prev, expanded: true }));
        return;
      }
      await loadReplies(comment.id);
    },
    [repliesByCommentId, updateReplyState, loadReplies],
  );

  const loadMoreReplies = useCallback(
    async (commentId: string) => {
      const current = repliesByCommentId[commentId];
      if (!current || current.loading || !current.hasNext || !current.nextCursor) return;
      await loadReplies(commentId, current.nextCursor, true);
    },
    [repliesByCommentId, loadReplies],
  );

  const submitDiscussion = useCallback(
    async (message: string): Promise<boolean> => {
      if (!eventId || !token) return false;
      const trimmed = message.trim();
      if (trimmed.length === 0) {
        setDiscussionSubmitError(i18n.t('errors.comments_post_empty_discussion'));
        return false;
      }
      setDiscussionSubmitLoading(true);
      setDiscussionSubmitError(null);
      try {
        const created = await createDiscussionComment(eventId, { message: trimmed }, token);
        setDiscussionComments((prev) => [created, ...prev]);
        return true;
      } catch (err) {
        setDiscussionSubmitError(mapCommentApiError(err, i18n.t('errors.comments_post_failed')));
        return false;
      } finally {
        setDiscussionSubmitLoading(false);
      }
    },
    [eventId, token],
  );

  const submitReply = useCallback(
    async (parentId: string, message: string): Promise<boolean> => {
      if (!eventId || !token) return false;
      const trimmed = message.trim();
      if (trimmed.length === 0) {
        setReplySubmitState({ parentId, loading: false, error: i18n.t('errors.comments_reply_empty') });
        return false;
      }
      setReplySubmitState({ parentId, loading: true, error: null });
      try {
        const created = await createDiscussionComment(
          eventId,
          { message: trimmed, parent_id: parentId },
          token,
        );
        setDiscussionComments((prev) =>
          prev.map((c) =>
            c.id === parentId ? { ...c, reply_count: c.reply_count + 1 } : c,
          ),
        );
        updateReplyState(parentId, (prev) => ({
          ...prev,
          items: [...prev.items, created],
          expanded: true,
        }));
        setReplySubmitState({ parentId: null, loading: false, error: null });
        return true;
      } catch (err) {
        setReplySubmitState({
          parentId,
          loading: false,
          error: mapCommentApiError(err, i18n.t('errors.comments_reply_failed')),
        });
        return false;
      }
    },
    [eventId, token, updateReplyState],
  );

  const submitReview = useCallback(
    async (rating: number, message: string, imageFile: File | null): Promise<boolean> => {
      if (!eventId || !token) return false;
      const trimmed = message.trim();
      if (rating < 1 || rating > 5) {
        setReviewSubmitError('Select a rating from 1 to 5 stars.');
        return false;
      }
      if (trimmed.length === 0) {
        setReviewSubmitError(i18n.t('errors.comments_review_empty'));
        return false;
      }
      setReviewSubmitLoading(true);
      setReviewSubmitError(null);
      setReviewSubmitSuccess(null);
      try {
        let imageConfirmToken: string | undefined;
        if (imageFile) {
          const { original, small } = await prepareAvatarBlobs(imageFile);
          const uploadInit = await getReviewCommentImageUploadUrl(eventId, token);
          await uploadImageVariants(uploadInit, { original, small });
          imageConfirmToken = uploadInit.confirm_token;
        }

        const upserted = await upsertReviewComment(
          eventId,
          {
            message: trimmed,
            rating,
            image_confirm_token: imageConfirmToken ?? null,
          },
          token,
        );

        setReviewComments((prev) => {
          const filtered = prev.filter((c) => c.id !== upserted.id);
          return [upserted, ...filtered];
        });

        if (reviewSuccessTimerRef.current) clearTimeout(reviewSuccessTimerRef.current);
        setReviewSubmitSuccess('Review submitted. Thanks for sharing your experience.');
        reviewSuccessTimerRef.current = setTimeout(() => {
          setReviewSubmitSuccess(null);
          reviewSuccessTimerRef.current = null;
        }, 5000);
        return true;
      } catch (err) {
        setReviewSubmitError(mapCommentApiError(err, i18n.t('errors.comments_review_failed')));
        return false;
      } finally {
        setReviewSubmitLoading(false);
      }
    },
    [eventId, token],
  );

  const dismissDiscussionSubmitError = useCallback(() => setDiscussionSubmitError(null), []);
  const dismissReplySubmitError = useCallback(
    () => setReplySubmitState((prev) => ({ ...prev, error: null, parentId: prev.loading ? prev.parentId : null })),
    [],
  );
  const dismissReviewSubmitError = useCallback(() => setReviewSubmitError(null), []);
  const dismissReviewSubmitSuccess = useCallback(() => {
    if (reviewSuccessTimerRef.current) {
      clearTimeout(reviewSuccessTimerRef.current);
      reviewSuccessTimerRef.current = null;
    }
    setReviewSubmitSuccess(null);
  }, []);

  return {
    status,
    errorMessage,

    discussionComments,
    discussionHasNext: discussionCursor.hasNext,
    discussionLoadingMore,

    reviewComments,
    reviewHasNext: reviewCursor.hasNext,
    reviewLoadingMore,

    repliesByCommentId,

    discussionSubmitLoading,
    discussionSubmitError,
    replySubmitState,
    reviewSubmitLoading,
    reviewSubmitError,
    reviewSubmitSuccess,

    retry: loadInitial,
    loadMoreDiscussion,
    loadMoreReviews,
    toggleReplies,
    loadMoreReplies,
    submitDiscussion,
    submitReply,
    submitReview,
    dismissDiscussionSubmitError,
    dismissReplySubmitError,
    dismissReviewSubmitError,
    dismissReviewSubmitSuccess,
  };
}

export type EventCommentsViewModel = ReturnType<typeof useEventCommentsViewModel>;
