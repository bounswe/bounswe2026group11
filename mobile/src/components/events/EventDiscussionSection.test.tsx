/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/i18n';
import type { EventComment } from '@/models/comment';
import type { EventDiscussionViewModel } from '@/viewmodels/event/useEventDiscussionViewModel';
import EventDiscussionSection from './EventDiscussionSection';

jest.mock('@expo/vector-icons', () => {
  const ReactLocal = require('react');
  const Icon = ({ name }: { name: string }) =>
    ReactLocal.createElement('span', { 'data-icon': name });

  return {
    Feather: Icon,
  };
});

const now = new Date('2026-05-11T12:00:00.000Z').getTime();

function makeComment(overrides: Partial<EventComment> = {}): EventComment {
  return {
    id: 'comment-1',
    event_id: 'event-1',
    user: {
      id: 'user-1',
      username: 'jane_doe',
      display_name: 'Jane Doe',
      avatar_url: null,
    },
    comment_type: 'DISCUSSION',
    message: 'Can I bring a friend?',
    parent_id: null,
    rating: null,
    image_url: null,
    likes_count: 0,
    reply_count: 2,
    created_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function buildViewModel(): EventDiscussionViewModel {
  const parent = makeComment();
  const replyOne = makeComment({
    id: 'reply-1',
    parent_id: parent.id,
    message: 'Yes, that should be okay.',
    created_at: new Date(now - 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 60 * 60 * 1000).toISOString(),
  });
  const replyTwo = makeComment({
    id: 'reply-2',
    parent_id: parent.id,
    message: 'Please ask the host first.',
    created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
  });

  return {
    discussions: {
      items: [parent],
      nextCursor: null,
      hasNext: false,
      loading: false,
    },
    reviews: {
      items: [],
      nextCursor: null,
      hasNext: false,
      loading: false,
    },
    repliesMap: {
      [parent.id]: {
        items: [replyOne, replyTwo],
        nextCursor: 'next-replies',
        hasNext: true,
        loading: false,
      },
    },
    newDiscussionMessage: '',
    setNewDiscussionMessage: jest.fn(),
    replyingToId: null,
    setReplyingToId: jest.fn(),
    replyMessage: '',
    setReplyMessage: jest.fn(),
    newReviewMessage: '',
    setNewReviewMessage: jest.fn(),
    newReviewRating: 0,
    setNewReviewRating: jest.fn(),
    discussionSubmitting: false,
    discussionError: null,
    reviewSubmitting: false,
    reviewError: null,
    loadMoreDiscussions: jest.fn().mockResolvedValue(undefined),
    loadMoreReviews: jest.fn().mockResolvedValue(undefined),
    loadReplies: jest.fn().mockResolvedValue(undefined),
    loadMoreReplies: jest.fn().mockResolvedValue(undefined),
    submitDiscussionComment: jest.fn().mockResolvedValue(undefined),
    submitReply: jest.fn().mockResolvedValue(undefined),
    submitReview: jest.fn().mockResolvedValue(undefined),
    dismissDiscussionError: jest.fn(),
    dismissReviewError: jest.fn(),
    refresh: jest.fn(),
  };
}

describe('EventDiscussionSection localization', () => {
  beforeEach(async () => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
    await act(async () => {
      await i18n.changeLanguage('tr');
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });

  it('localizes reply toggles and relative timestamps in Turkish', () => {
    render(
      <EventDiscussionSection
        vm={buildViewModel()}
        eventStatus="ACTIVE"
        isAuthenticated
        canPostDiscussion={false}
        canPostReview={false}
        hasExistingReview={false}
      />,
    );

    expect(screen.getByText('2 yanıtı göster')).toBeTruthy();
    expect(screen.getByText('2 gün önce')).toBeTruthy();
    expect(screen.queryByText(/repl/)).toBeNull();
    expect(screen.queryByText(/ago/)).toBeNull();

    fireEvent.click(screen.getByTestId('reply-toggle-comment-1'));

    expect(screen.getByText('2 yanıtı gizle')).toBeTruthy();
    expect(screen.getByText('1 saat önce')).toBeTruthy();
    expect(screen.getByText('2 saat önce')).toBeTruthy();
    expect(screen.getByText('Daha fazla yanıt yükle')).toBeTruthy();
  });
});
