/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import * as commentService from '@/services/commentService';
import { ApiError } from '@/services/api';
import type { EventComment, EventCommentsResponse, CommentCollection } from '@/models/comment';
import { useEventDiscussionViewModel } from './useEventDiscussionViewModel';

jest.mock('@/services/commentService');

const mockListEventComments = jest.mocked(commentService.listEventComments);
const mockListCommentReplies = jest.mocked(commentService.listCommentReplies);
const mockCreateDiscussionComment = jest.mocked(commentService.createDiscussionComment);
const mockUpsertReviewComment = jest.mocked(commentService.upsertReviewComment);

const mockDiscussionComment: EventComment = {
  id: 'comment-001',
  event_id: 'event-001',
  user: { id: 'user-001', username: 'alice', display_name: 'Alice', avatar_url: null },
  comment_type: 'DISCUSSION',
  message: 'When does check-in open?',
  parent_id: null,
  rating: null,
  image_url: null,
  likes_count: 0,
  reply_count: 1,
  created_at: '2026-05-01T10:00:00Z',
  updated_at: '2026-05-01T10:00:00Z',
};

const mockReviewComment: EventComment = {
  id: 'comment-002',
  event_id: 'event-001',
  user: { id: 'user-002', username: 'bob', display_name: 'Bob', avatar_url: null },
  comment_type: 'REVIEW',
  message: 'Amazing event!',
  parent_id: null,
  rating: 5,
  image_url: null,
  likes_count: 2,
  reply_count: 0,
  created_at: '2026-05-03T10:00:00Z',
  updated_at: '2026-05-03T10:00:00Z',
};

const mockReplyComment: EventComment = {
  id: 'comment-003',
  event_id: 'event-001',
  user: { id: 'user-003', username: 'carol', display_name: 'Carol', avatar_url: null },
  comment_type: 'DISCUSSION',
  message: 'Check-in opens at 8 AM.',
  parent_id: 'comment-001',
  rating: null,
  image_url: null,
  likes_count: 0,
  reply_count: 0,
  created_at: '2026-05-01T11:00:00Z',
  updated_at: '2026-05-01T11:00:00Z',
};

function makeEmptyResponse(): EventCommentsResponse {
  return {
    discussion_comments: { items: [], page_info: { next_cursor: null, has_next: false } },
    review_comments: { items: [], page_info: { next_cursor: null, has_next: false } },
  };
}

function makePopulatedResponse(): EventCommentsResponse {
  return {
    discussion_comments: {
      items: [mockDiscussionComment],
      page_info: { next_cursor: null, has_next: false },
    },
    review_comments: {
      items: [mockReviewComment],
      page_info: { next_cursor: null, has_next: false },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListEventComments.mockResolvedValue(makeEmptyResponse());
  mockListCommentReplies.mockResolvedValue({
    items: [],
    page_info: { next_cursor: null, has_next: false },
  });
  mockCreateDiscussionComment.mockResolvedValue(mockDiscussionComment);
  mockUpsertReviewComment.mockResolvedValue(mockReviewComment);
});

describe('useEventDiscussionViewModel — initial load', () => {
  it('loads discussion and review comments on mount', async () => {
    mockListEventComments.mockResolvedValueOnce(makePopulatedResponse());

    const { result } = renderHook(() =>
      useEventDiscussionViewModel('event-001', 'mock-token'),
    );

    await waitFor(() => {
      expect(result.current.discussions.loading).toBe(false);
    });

    expect(result.current.discussions.items).toHaveLength(1);
    expect(result.current.discussions.items[0].id).toBe('comment-001');
    expect(result.current.reviews.items).toHaveLength(1);
    expect(result.current.reviews.items[0].id).toBe('comment-002');
  });

  it('passes token to listEventComments', async () => {
    renderHook(() => useEventDiscussionViewModel('event-001', 'test-token'));

    await waitFor(() => {
      expect(mockListEventComments).toHaveBeenCalledWith(
        'event-001',
        expect.any(Object),
        'test-token',
      );
    });
  });

  it('works without a token (unauthenticated)', async () => {
    renderHook(() => useEventDiscussionViewModel('event-001'));

    await waitFor(() => {
      expect(mockListEventComments).toHaveBeenCalledWith(
        'event-001',
        expect.any(Object),
        undefined,
      );
    });
  });

  it('handles fetch failure gracefully without throwing', async () => {
    mockListEventComments.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useEventDiscussionViewModel('event-001', 'tok'));

    await waitFor(() => {
      expect(result.current.discussions.loading).toBe(false);
    });

    expect(result.current.discussions.items).toHaveLength(0);
    expect(result.current.reviews.items).toHaveLength(0);
  });
});

describe('useEventDiscussionViewModel — pagination', () => {
  it('appends more discussions on loadMoreDiscussions', async () => {
    const page2Comment: EventComment = {
      ...mockDiscussionComment,
      id: 'comment-004',
      message: 'Page 2 question',
    };

    mockListEventComments
      .mockResolvedValueOnce({
        discussion_comments: {
          items: [mockDiscussionComment],
          page_info: { next_cursor: 'cursor-page2', has_next: true },
        },
        review_comments: { items: [], page_info: { next_cursor: null, has_next: false } },
      })
      .mockResolvedValueOnce({
        discussion_comments: {
          items: [page2Comment],
          page_info: { next_cursor: null, has_next: false },
        },
        review_comments: { items: [], page_info: { next_cursor: null, has_next: false } },
      });

    const { result } = renderHook(() =>
      useEventDiscussionViewModel('event-001', 'tok'),
    );

    await waitFor(() => expect(result.current.discussions.items).toHaveLength(1));
    expect(result.current.discussions.hasNext).toBe(true);

    await act(async () => {
      await result.current.loadMoreDiscussions();
    });

    expect(result.current.discussions.items).toHaveLength(2);
    expect(result.current.discussions.items[1].id).toBe('comment-004');
    expect(result.current.discussions.hasNext).toBe(false);
  });

  it('does not load more when hasNext is false', async () => {
    const { result } = renderHook(() => useEventDiscussionViewModel('event-001', 'tok'));

    await waitFor(() => expect(result.current.discussions.loading).toBe(false));

    mockListEventComments.mockClear();
    await act(async () => {
      await result.current.loadMoreDiscussions();
    });

    expect(mockListEventComments).not.toHaveBeenCalled();
  });
});

describe('useEventDiscussionViewModel — replies', () => {
  it('loads replies for a parent comment', async () => {
    const repliesCollection: CommentCollection = {
      items: [mockReplyComment],
      page_info: { next_cursor: null, has_next: false },
    };
    mockListCommentReplies.mockResolvedValueOnce(repliesCollection);

    const { result } = renderHook(() =>
      useEventDiscussionViewModel('event-001', 'tok'),
    );

    await waitFor(() => expect(result.current.discussions.loading).toBe(false));

    await act(async () => {
      await result.current.loadReplies('comment-001');
    });

    expect(result.current.repliesMap['comment-001'].items).toHaveLength(1);
    expect(result.current.repliesMap['comment-001'].items[0].parent_id).toBe('comment-001');
  });

  it('appends more replies on loadMoreReplies', async () => {
    const reply1: EventComment = { ...mockReplyComment, id: 'reply-001' };
    const reply2: EventComment = { ...mockReplyComment, id: 'reply-002' };

    mockListCommentReplies
      .mockResolvedValueOnce({
        items: [reply1],
        page_info: { next_cursor: 'reply-cursor', has_next: true },
      })
      .mockResolvedValueOnce({
        items: [reply2],
        page_info: { next_cursor: null, has_next: false },
      });

    const { result } = renderHook(() =>
      useEventDiscussionViewModel('event-001', 'tok'),
    );

    await waitFor(() => expect(result.current.discussions.loading).toBe(false));

    await act(async () => {
      await result.current.loadReplies('comment-001');
    });

    expect(result.current.repliesMap['comment-001'].items).toHaveLength(1);
    expect(result.current.repliesMap['comment-001'].hasNext).toBe(true);

    await act(async () => {
      await result.current.loadMoreReplies('comment-001');
    });

    expect(result.current.repliesMap['comment-001'].items).toHaveLength(2);
  });
});

describe('useEventDiscussionViewModel — submitDiscussionComment', () => {
  it('prepends the new comment to discussions list on success', async () => {
    const newComment: EventComment = {
      ...mockDiscussionComment,
      id: 'comment-new',
      message: 'New question',
    };
    mockCreateDiscussionComment.mockResolvedValueOnce(newComment);

    const { result } = renderHook(() =>
      useEventDiscussionViewModel('event-001', 'mock-token'),
    );

    await waitFor(() => expect(result.current.discussions.loading).toBe(false));

    await act(async () => {
      result.current.setNewDiscussionMessage('New question');
    });

    await act(async () => {
      await result.current.submitDiscussionComment();
    });

    expect(mockCreateDiscussionComment).toHaveBeenCalledWith(
      'event-001',
      { message: 'New question' },
      'mock-token',
    );
    expect(result.current.discussions.items[0].id).toBe('comment-new');
    expect(result.current.newDiscussionMessage).toBe('');
  });

  it('sets discussionError when createDiscussionComment fails', async () => {
    mockCreateDiscussionComment.mockRejectedValueOnce(
      new ApiError(409, {
        error: { code: 'comment_write_not_allowed', message: 'Not allowed' },
      }),
    );

    const { result } = renderHook(() =>
      useEventDiscussionViewModel('event-001', 'mock-token'),
    );

    await waitFor(() => expect(result.current.discussions.loading).toBe(false));

    await act(async () => {
      result.current.setNewDiscussionMessage('Hello');
    });

    await act(async () => {
      await result.current.submitDiscussionComment();
    });

    expect(result.current.discussionError).toBe(
      'You cannot post comments on this event.',
    );
  });

  it('does nothing when message is empty', async () => {
    const { result } = renderHook(() =>
      useEventDiscussionViewModel('event-001', 'mock-token'),
    );

    await waitFor(() => expect(result.current.discussions.loading).toBe(false));

    await act(async () => {
      await result.current.submitDiscussionComment();
    });

    expect(mockCreateDiscussionComment).not.toHaveBeenCalled();
  });

  it('dismissDiscussionError clears the error', async () => {
    mockCreateDiscussionComment.mockRejectedValueOnce(
      new ApiError(409, { error: { code: 'comments_not_allowed', message: 'Nope' } }),
    );

    const { result } = renderHook(() =>
      useEventDiscussionViewModel('event-001', 'tok'),
    );

    await waitFor(() => expect(result.current.discussions.loading).toBe(false));

    await act(async () => {
      result.current.setNewDiscussionMessage('Hi');
    });

    await act(async () => {
      await result.current.submitDiscussionComment();
    });

    expect(result.current.discussionError).not.toBeNull();

    act(() => {
      result.current.dismissDiscussionError();
    });

    expect(result.current.discussionError).toBeNull();
  });
});

describe('useEventDiscussionViewModel — submitReply', () => {
  it('appends the reply to repliesMap and increments reply_count', async () => {
    mockListEventComments.mockResolvedValueOnce({
      discussion_comments: {
        items: [mockDiscussionComment],
        page_info: { next_cursor: null, has_next: false },
      },
      review_comments: { items: [], page_info: { next_cursor: null, has_next: false } },
    });

    const newReply: EventComment = { ...mockReplyComment, id: 'new-reply' };
    mockCreateDiscussionComment.mockResolvedValueOnce(newReply);

    const { result } = renderHook(() =>
      useEventDiscussionViewModel('event-001', 'mock-token'),
    );

    await waitFor(() => expect(result.current.discussions.items).toHaveLength(1));

    await act(async () => {
      result.current.setReplyMessage('Thanks for the info!');
    });

    await act(async () => {
      await result.current.submitReply('comment-001');
    });

    expect(result.current.repliesMap['comment-001'].items[0].id).toBe('new-reply');
    expect(result.current.replyMessage).toBe('');
    expect(result.current.replyingToId).toBeNull();

    const parent = result.current.discussions.items.find((c) => c.id === 'comment-001');
    expect(parent?.reply_count).toBe(2);
  });
});

describe('useEventDiscussionViewModel — submitReview', () => {
  it('upserts the review and updates the reviews list', async () => {
    const updatedReview: EventComment = { ...mockReviewComment, message: 'Updated review', rating: 4 };
    mockUpsertReviewComment.mockResolvedValueOnce(updatedReview);

    const { result } = renderHook(() =>
      useEventDiscussionViewModel('event-001', 'mock-token'),
    );

    await waitFor(() => expect(result.current.reviews.loading).toBe(false));

    await act(async () => {
      result.current.setNewReviewMessage('Updated review');
      result.current.setNewReviewRating(4);
    });

    await act(async () => {
      await result.current.submitReview();
    });

    expect(mockUpsertReviewComment).toHaveBeenCalledWith(
      'event-001',
      { message: 'Updated review', rating: 4 },
      'mock-token',
    );
    expect(result.current.reviews.items[0].message).toBe('Updated review');
    expect(result.current.newReviewMessage).toBe('');
    expect(result.current.newReviewRating).toBe(0);
  });

  it('replaces existing review from same user instead of appending', async () => {
    const existingReview: EventComment = { ...mockReviewComment, id: 'review-001' };
    mockListEventComments.mockResolvedValueOnce({
      discussion_comments: { items: [], page_info: { next_cursor: null, has_next: false } },
      review_comments: {
        items: [existingReview],
        page_info: { next_cursor: null, has_next: false },
      },
    });

    const updatedReview: EventComment = {
      ...existingReview,
      message: 'Actually it was 4 stars.',
      rating: 4,
    };
    mockUpsertReviewComment.mockResolvedValueOnce(updatedReview);

    const { result } = renderHook(() =>
      useEventDiscussionViewModel('event-001', 'mock-token'),
    );

    await waitFor(() => expect(result.current.reviews.items).toHaveLength(1));

    await act(async () => {
      result.current.setNewReviewMessage('Actually it was 4 stars.');
      result.current.setNewReviewRating(4);
    });

    await act(async () => {
      await result.current.submitReview();
    });

    expect(result.current.reviews.items).toHaveLength(1);
    expect(result.current.reviews.items[0].rating).toBe(4);
  });

  it('does nothing when rating is 0', async () => {
    const { result } = renderHook(() =>
      useEventDiscussionViewModel('event-001', 'mock-token'),
    );

    await waitFor(() => expect(result.current.reviews.loading).toBe(false));

    await act(async () => {
      result.current.setNewReviewMessage('Great event');
      await result.current.submitReview();
    });

    expect(mockUpsertReviewComment).not.toHaveBeenCalled();
  });

  it('sets reviewError on failure and dismissReviewError clears it', async () => {
    mockUpsertReviewComment.mockRejectedValueOnce(
      new ApiError(403, {
        error: { code: 'host_cannot_rate_self', message: 'Host cannot rate self' },
      }),
    );

    const { result } = renderHook(() =>
      useEventDiscussionViewModel('event-001', 'mock-token'),
    );

    await waitFor(() => expect(result.current.reviews.loading).toBe(false));

    await act(async () => {
      result.current.setNewReviewMessage('Great event');
      result.current.setNewReviewRating(5);
    });

    await act(async () => {
      await result.current.submitReview();
    });

    expect(result.current.reviewError).toBe('Hosts cannot review their own event.');

    act(() => {
      result.current.dismissReviewError();
    });

    expect(result.current.reviewError).toBeNull();
  });
});

describe('useEventDiscussionViewModel — refresh', () => {
  it('reloads comments on refresh', async () => {
    mockListEventComments
      .mockResolvedValueOnce(makeEmptyResponse())
      .mockResolvedValueOnce(makePopulatedResponse());

    const { result } = renderHook(() =>
      useEventDiscussionViewModel('event-001', 'tok'),
    );

    await waitFor(() => expect(result.current.discussions.loading).toBe(false));
    expect(result.current.discussions.items).toHaveLength(0);

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.discussions.items).toHaveLength(1);
    });

    expect(mockListEventComments).toHaveBeenCalledTimes(2);
  });
});
