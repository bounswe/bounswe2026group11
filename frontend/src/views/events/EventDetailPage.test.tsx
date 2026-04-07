// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { EventDetailResponse } from '@/models/event';
import EventDetailPage from './EventDetailPage';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'token' }),
}));

const mockUseEventDetailViewModel = vi.fn();

vi.mock('@/viewmodels/event/useEventDetailViewModel', () => ({
  useEventDetailViewModel: (...args: unknown[]) => mockUseEventDetailViewModel(...args),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeBaseEvent(): EventDetailResponse {
  return {
    id: 'event-1',
    title: 'Sunset Walk',
    description: 'A relaxed walk by the coast.',
    image_url: null,
    privacy_level: 'PUBLIC',
    status: 'COMPLETED',
    start_time: '2026-04-01T17:00:00Z',
    end_time: '2026-04-01T19:00:00Z',
    capacity: 20,
    minimum_age: null,
    preferred_gender: null,
    approved_participant_count: 8,
    pending_participant_count: 0,
    favorite_count: 3,
    created_at: '2026-03-20T10:00:00Z',
    updated_at: '2026-04-02T10:00:00Z',
    category: { id: 1, name: 'Outdoors' },
    host: {
      id: 'host-1',
      username: 'hostuser',
      display_name: 'Host User',
      avatar_url: null,
    },
    host_score: {
      final_score: 4.7,
      hosted_event_rating_count: 12,
    },
    location: {
      type: 'POINT',
      address: 'Moda Coast',
      point: { lat: 40.98, lon: 29.03 },
      route_points: [],
    },
    tags: ['walk'],
    constraints: [],
    rating_window: {
      opens_at: '2026-04-01T19:00:00Z',
      closes_at: '2026-04-08T19:00:00Z',
      is_active: true,
    },
    viewer_event_rating: null,
    viewer_context: {
      is_host: false,
      is_favorited: false,
      participation_status: 'JOINED',
    },
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/events/event-1']}>
      <Routes>
        <Route path="/events/:id" element={<EventDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function makeReadyViewModel(event: EventDetailResponse) {
  return {
    event,
    status: 'ready' as const,
    errorMessage: null,
    hostContextSummary: null,
    hostContextLoading: false,
    approvedParticipants: [],
    approvedParticipantsLoading: false,
    approvedParticipantsHasNext: false,
    pendingJoinRequests: [],
    pendingJoinRequestsLoading: false,
    pendingJoinRequestsHasNext: false,
    invitations: [],
    invitationsLoading: false,
    invitationsHasNext: false,
    joinLoading: false,
    joinError: null,
    viewerRatingLoading: false,
    viewerRatingError: null,
    participantRatingLoadingId: null,
    participantRatingError: null,
    moderatingId: null,
    moderateError: null,
    cancelLoading: false,
    cancelError: null,
    retry: vi.fn(),
    handleJoin: vi.fn(),
    handleRequestJoin: vi.fn(),
    handleViewerRatingSubmit: vi.fn(),
    handleParticipantRatingSubmit: vi.fn(),
    handleApprove: vi.fn(),
    handleReject: vi.fn(),
    handleCancel: vi.fn(),
    dismissJoinError: vi.fn(),
    dismissViewerRatingError: vi.fn(),
    dismissParticipantRatingError: vi.fn(),
    dismissModerateError: vi.fn(),
    dismissCancelError: vi.fn(),
    coverImageUploading: false,
    coverImageError: null,
    coverImageSuccessMessage: null,
    handleCoverImageUpload: vi.fn(),
    dismissCoverImageError: vi.fn(),
    dismissCoverImageSuccess: vi.fn(),
    loadMoreApprovedParticipants: vi.fn(),
    loadMorePendingJoinRequests: vi.fn(),
    loadMoreInvitations: vi.fn(),
  };
}

describe('EventDetailPage ratings', () => {
  it('shows existing participant rating in summary mode until edit is requested', () => {
    const event = makeBaseEvent();
    event.viewer_event_rating = {
      id: 'rating-1',
      rating: 5,
      message: 'Great host and very smooth event.',
      created_at: '2026-04-02T10:00:00Z',
      updated_at: '2026-04-03T10:00:00Z',
    };

    mockUseEventDetailViewModel.mockReturnValue(makeReadyViewModel(event));

    renderPage();

    expect(screen.getByText(/update your rating for the host/i)).toBeDefined();
    expect(screen.getByText(/great host and very smooth event\./i)).toBeDefined();
    expect(screen.getByRole('button', { name: /edit rating/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /update rating/i })).toBeNull();
  });

  it('hides the participant rating card for non-participants', () => {
    const event = makeBaseEvent();
    event.viewer_context.participation_status = 'NONE';

    mockUseEventDetailViewModel.mockReturnValue(makeReadyViewModel(event));

    renderPage();

    expect(screen.queryByText(/post-event feedback/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /submit rating/i })).toBeNull();
  });

  it('shows host-side participant ratings and edit actions in the management list', () => {
    const event = makeBaseEvent();
    event.viewer_context = {
      is_host: true,
      is_favorited: false,
      participation_status: 'NONE',
    };
    const vm = makeReadyViewModel(event);
    vm.hostContextSummary = {
      approved_participant_count: 1,
      pending_join_request_count: 0,
      invitation_count: 0,
    };
    vm.approvedParticipants = [
      {
        participation_id: 'participation-1',
        status: 'APPROVED',
        created_at: '2026-03-28T10:00:00Z',
        updated_at: '2026-03-28T10:00:00Z',
        host_rating: {
          id: 'participant-rating-1',
          rating: 4,
          message: 'Reliable and easy to coordinate with.',
          created_at: '2026-04-02T10:00:00Z',
          updated_at: '2026-04-02T10:00:00Z',
        },
        user: {
          id: 'participant-1',
          username: 'participant',
          display_name: 'Approved User',
          avatar_url: null,
          final_score: 4.3,
          rating_count: 5,
        },
      },
    ];

    mockUseEventDetailViewModel.mockReturnValue(vm);

    renderPage();

    expect(screen.getByText(/approved participants \(1\)/i)).toBeDefined();
    expect(screen.getByText(/4\/5/i)).toBeDefined();
    expect(screen.getByText(/reliable and easy to coordinate with\./i)).toBeDefined();
    expect(screen.getByRole('button', { name: /edit rating/i })).toBeDefined();
  });

  it('shows a pending join-request banner instead of join actions', () => {
    const event = makeBaseEvent();
    event.status = 'ACTIVE';
    event.privacy_level = 'PROTECTED';
    event.viewer_context.participation_status = 'PENDING';

    mockUseEventDetailViewModel.mockReturnValue(makeReadyViewModel(event));

    renderPage();

    expect(screen.getByText(/your join request is pending approval/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: /request to join/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /join event/i })).toBeNull();
  });
});
