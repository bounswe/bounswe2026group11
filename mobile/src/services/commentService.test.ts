import {
  listEventComments,
  listCommentReplies,
  createDiscussionComment,
  upsertReviewComment,
} from './commentService';
import { ApiError } from './api';
import type { EventCommentsResponse, CommentCollection, EventComment } from '@/models/comment';

const originalFetch = global.fetch;
const mockFetch = jest.fn();

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as any;
}

const mockComment: EventComment = {
  id: 'comment-uuid-001',
  event_id: 'event-uuid-001',
  user: { id: 'user-001', username: 'alice', display_name: 'Alice', avatar_url: null },
  comment_type: 'DISCUSSION',
  message: 'When does registration close?',
  parent_id: null,
  rating: null,
  image_url: null,
  likes_count: 0,
  reply_count: 2,
  created_at: '2026-05-01T10:00:00Z',
  updated_at: '2026-05-01T10:00:00Z',
};

const mockReview: EventComment = {
  id: 'comment-uuid-002',
  event_id: 'event-uuid-001',
  user: { id: 'user-002', username: 'bob', display_name: 'Bob', avatar_url: null },
  comment_type: 'REVIEW',
  message: 'Great event!',
  parent_id: null,
  rating: 5,
  image_url: null,
  likes_count: 3,
  reply_count: 0,
  created_at: '2026-05-02T10:00:00Z',
  updated_at: '2026-05-02T10:00:00Z',
};

const mockCommentsResponse: EventCommentsResponse = {
  discussion_comments: {
    items: [mockComment],
    page_info: { next_cursor: null, has_next: false },
  },
  review_comments: {
    items: [mockReview],
    page_info: { next_cursor: null, has_next: false },
  },
};

const mockRepliesResponse: CommentCollection = {
  items: [
    {
      id: 'comment-uuid-003',
      event_id: 'event-uuid-001',
      user: { id: 'user-003', username: 'carol', display_name: 'Carol', avatar_url: null },
      comment_type: 'DISCUSSION',
      message: 'Registration closes 3 days before.',
      parent_id: 'comment-uuid-001',
      rating: null,
      image_url: null,
      likes_count: 1,
      reply_count: 0,
      created_at: '2026-05-01T11:00:00Z',
      updated_at: '2026-05-01T11:00:00Z',
    },
  ],
  page_info: { next_cursor: null, has_next: false },
};

jest.mock('@/config/apiBaseUrl', () => ({ API_BASE_URL: 'https://api.test' }));
jest.mock('@/services/sessionManager', () => ({
  getCurrentSession: () => ({ access_token: 'stored-token', refresh_token: 'rt' }),
  refreshSession: jest.fn().mockResolvedValue({ access_token: 'new-token' }),
}));

beforeEach(() => {
  global.fetch = mockFetch as any;
  mockFetch.mockReset();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('listEventComments', () => {
  it('fetches comments without auth when no token provided', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(mockCommentsResponse));

    const result = await listEventComments('event-uuid-001');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test/events/event-uuid-001/comments',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.discussion_comments.items).toHaveLength(1);
    expect(result.review_comments.items).toHaveLength(1);
  });

  it('fetches comments with auth when token provided', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(mockCommentsResponse));

    const result = await listEventComments('event-uuid-001', {}, 'mock-token');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test/events/event-uuid-001/comments',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer stored-token' }),
      }),
    );
    expect(result).toEqual(mockCommentsResponse);
  });

  it('builds correct query string with pagination params', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(mockCommentsResponse));

    await listEventComments(
      'event-uuid-001',
      { discussion_limit: 10, discussion_cursor: 'cursor-abc', review_limit: 5 },
      'mock-token',
    );

    const calledUrl: string = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('discussion_limit=10');
    expect(calledUrl).toContain('discussion_cursor=cursor-abc');
    expect(calledUrl).toContain('review_limit=5');
  });

  it('throws ApiError on non-2xx response', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: { code: 'comments_not_allowed', message: 'Private event' } }, 409),
    );

    await expect(listEventComments('event-uuid-001')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('listCommentReplies', () => {
  it('fetches replies for a parent comment', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(mockRepliesResponse));

    const result = await listCommentReplies('event-uuid-001', 'comment-uuid-001');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test/events/event-uuid-001/comments/comment-uuid-001/replies',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].parent_id).toBe('comment-uuid-001');
  });

  it('passes cursor and limit in query string', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(mockRepliesResponse));

    await listCommentReplies(
      'event-uuid-001',
      'comment-uuid-001',
      { limit: 10, cursor: 'reply-cursor' },
      'tok',
    );

    const calledUrl: string = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('limit=10');
    expect(calledUrl).toContain('cursor=reply-cursor');
  });
});

describe('createDiscussionComment', () => {
  it('posts a new top-level discussion comment', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(mockComment, 201));

    const result = await createDiscussionComment(
      'event-uuid-001',
      { message: 'When does registration close?' },
      'mock-token',
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test/events/event-uuid-001/comments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ message: 'When does registration close?' }),
      }),
    );
    expect(result.id).toBe('comment-uuid-001');
    expect(result.comment_type).toBe('DISCUSSION');
  });

  it('posts a reply with parent_id', async () => {
    const reply: EventComment = { ...mockComment, id: 'reply-001', parent_id: 'comment-uuid-001' };
    mockFetch.mockResolvedValueOnce(jsonResponse(reply, 201));

    const result = await createDiscussionComment(
      'event-uuid-001',
      { message: 'Thanks!', parent_id: 'comment-uuid-001' },
      'mock-token',
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.parent_id).toBe('comment-uuid-001');
    expect(result.parent_id).toBe('comment-uuid-001');
  });

  it('throws ApiError when write is not allowed', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        { error: { code: 'comment_write_not_allowed', message: 'Not allowed' } },
        409,
      ),
    );

    await expect(
      createDiscussionComment('event-uuid-001', { message: 'Hello' }, 'tok'),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('upsertReviewComment', () => {
  it('posts a review with rating and message', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(mockReview));

    const result = await upsertReviewComment(
      'event-uuid-001',
      { message: 'Great event!', rating: 5 },
      'mock-token',
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test/events/event-uuid-001/review-comments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ message: 'Great event!', rating: 5 }),
      }),
    );
    expect(result.rating).toBe(5);
    expect(result.comment_type).toBe('REVIEW');
  });

  it('throws ApiError when host tries to review own event', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        { error: { code: 'host_cannot_rate_self', message: 'Hosts cannot rate themselves' } },
        403,
      ),
    );

    await expect(
      upsertReviewComment('event-uuid-001', { message: 'Great', rating: 5 }, 'tok'),
    ).rejects.toMatchObject({ code: 'host_cannot_rate_self' });
  });
});
