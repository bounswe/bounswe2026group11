// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type {
  EventDetailPendingJoinRequest,
  EventDetailResponse,
  EventHostContextSummary,
} from '@/models/event';
import EventDetailPage, { buildDirectionsUrl } from './EventDetailPage';

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
      is_location_approximate: false,
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
    hostContextSummary: null as EventHostContextSummary | null,
    hostContextLoading: false,
    approvedParticipants: [],
    approvedParticipantsLoading: false,
    approvedParticipantsHasNext: false,
    pendingJoinRequests: [] as EventDetailPendingJoinRequest[],
    pendingJoinRequestsLoading: false,
    pendingJoinRequestsHasNext: false,
    invitations: [],
    invitationsLoading: false,
    invitationsHasNext: false,
    joinLoading: false,
    joinError: null,
    leaveLoading: false,
    leaveError: null,
    viewerRatingLoading: false,
    viewerRatingError: null,
    participantRatingLoadingId: null,
    participantRatingError: null,
    moderatingId: null,
    moderateError: null,
    cancelLoading: false,
    cancelError: null,
    favoriteLoading: false,
    reportLoading: false,
    reportError: null,
    reportSuccessMessage: null,
    retry: vi.fn(),
    handleJoin: vi.fn(),
    handleLeave: vi.fn(),
    handleRequestJoin: vi.fn(),
    handleViewerRatingSubmit: vi.fn(),
    handleParticipantRatingSubmit: vi.fn(),
    handleApprove: vi.fn(),
    handleReject: vi.fn(),
    handleCancel: vi.fn(),
    handleFavoriteToggle: vi.fn(),
    handleReportEvent: vi.fn(),
    dismissJoinError: vi.fn(),
    dismissLeaveError: vi.fn(),
    dismissViewerRatingError: vi.fn(),
    dismissParticipantRatingError: vi.fn(),
    dismissModerateError: vi.fn(),
    dismissCancelError: vi.fn(),
    dismissReportError: vi.fn(),
    dismissReportSuccess: vi.fn(),
    coverImageUploading: false,
    coverImageError: null,
    coverImageSuccessMessage: null,
    handleCoverImageUpload: vi.fn(),
    dismissCoverImageError: vi.fn(),
    dismissCoverImageSuccess: vi.fn(),
    loadMoreApprovedParticipants: vi.fn(),
    loadMorePendingJoinRequests: vi.fn(),
    loadMoreInvitations: vi.fn(),
    inviteLoading: false,
    inviteError: null,
    inviteResult: null,
    handleCreateInvitations: vi.fn(),
    dismissInviteError: vi.fn(),
    clearInviteResult: vi.fn(),
  };
}

describe('EventDetailPage ratings', () => {
  it('opens the report modal from the flag button and submits the selected reason', async () => {
    const event = makeBaseEvent();
    const vm = makeReadyViewModel(event);
    vm.handleReportEvent.mockResolvedValue(true);
    mockUseEventDetailViewModel.mockReturnValue(vm);

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /report event/i }));
    fireEvent.click(screen.getByLabelText(/harassment/i));
    fireEvent.change(screen.getByLabelText(/additional details/i), {
      target: { value: 'The event description targets a user group.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit report/i }));

    await waitFor(() => {
      expect(vm.handleReportEvent).toHaveBeenCalledWith(
        'HARASSMENT',
        'The event description targets a user group.',
      );
    });
  });

  it('shows report success state from the view model', () => {
    const event = makeBaseEvent();
    const vm = makeReadyViewModel(event);
    vm.reportSuccessMessage = 'Thanks. Your report has been submitted for review.';
    mockUseEventDetailViewModel.mockReturnValue(vm);

    renderPage();

    expect(screen.getByText(/submitted for review/i)).toBeDefined();
  });

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

  it('renders the directions link with the event coordinates when location is a POINT', () => {
    const event = makeBaseEvent();

    mockUseEventDetailViewModel.mockReturnValue(makeReadyViewModel(event));

    renderPage();

    const link = screen.getByTestId('ed-directions-link') as HTMLAnchorElement;
    expect(link).toBeDefined();
    expect(link.href).toContain(
      'https://www.google.com/maps/dir/?api=1&destination=',
    );
    expect(link.href).toContain(encodeURIComponent('40.98,29.03'));
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });

  it('shows approximate area copy and hides directions for approximate protected locations', () => {
    const event = makeBaseEvent();
    event.privacy_level = 'PROTECTED';
    event.viewer_context.participation_status = 'NONE';
    event.location = {
      type: 'POINT',
      address: null,
      point: { lat: 40.981, lon: 29.032 },
      route_points: [],
      is_location_approximate: true,
    };

    mockUseEventDetailViewModel.mockReturnValue(makeReadyViewModel(event));

    renderPage();

    expect(screen.getByText(/^approximate area$/i)).toBeDefined();
    expect(screen.getByText(/approximate location shown/i)).toBeDefined();
    expect(screen.getByText(/hides its exact address until your participation is approved/i)).toBeDefined();
    expect(screen.getByText(/exact address is visible after approval/i)).toBeDefined();
    expect(screen.queryByTestId('ed-directions-link')).toBeNull();
  });

  it('shows the map fallback and hides the directions link when coordinates are missing', () => {
    const event = makeBaseEvent();
    event.location = {
      type: 'POINT',
      address: 'No coordinates here',
      point: null,
      route_points: [],
      is_location_approximate: false,
    };

    mockUseEventDetailViewModel.mockReturnValue(makeReadyViewModel(event));

    renderPage();

    expect(screen.getByText(/map unavailable for this event/i)).toBeDefined();
    expect(screen.queryByTestId('ed-directions-link')).toBeNull();
  });

  it('builds a Google Maps directions URL with encoded destination coordinates', () => {
    const url = buildDirectionsUrl(40.98, 29.03);
    expect(url).toBe(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('40.98,29.03')}`,
    );
  });

  it('shows the Invite Users button on private events for the host', () => {
    const event = makeBaseEvent();
    event.privacy_level = 'PRIVATE';
    event.status = 'ACTIVE';
    event.viewer_context = {
      is_host: true,
      is_favorited: false,
      participation_status: 'NONE',
    };
    const vm = makeReadyViewModel(event);
    vm.hostContextSummary = {
      approved_participant_count: 0,
      pending_join_request_count: 0,
      invitation_count: 0,
    };

    mockUseEventDetailViewModel.mockReturnValue(vm);
    renderPage();

    expect(screen.getByTestId('ed-invite-open')).toBeDefined();
    expect(screen.getByText(/no invitations sent yet/i)).toBeDefined();
  });

  it('hides the Invite Users button on public events even for the host', () => {
    const event = makeBaseEvent();
    event.privacy_level = 'PUBLIC';
    event.status = 'ACTIVE';
    event.viewer_context = {
      is_host: true,
      is_favorited: false,
      participation_status: 'NONE',
    };
    const vm = makeReadyViewModel(event);
    vm.hostContextSummary = {
      approved_participant_count: 0,
      pending_join_request_count: 0,
      invitation_count: 0,
    };

    mockUseEventDetailViewModel.mockReturnValue(vm);
    renderPage();

    expect(screen.queryByTestId('ed-invite-open')).toBeNull();
  });

  it('hides the Invite Users button for non-host viewers on private events', () => {
    const event = makeBaseEvent();
    event.privacy_level = 'PRIVATE';
    event.status = 'ACTIVE';
    event.viewer_context = {
      is_host: false,
      is_favorited: false,
      participation_status: 'NONE',
    };

    mockUseEventDetailViewModel.mockReturnValue(makeReadyViewModel(event));
    renderPage();

    expect(screen.queryByTestId('ed-invite-open')).toBeNull();
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

  it('shows the proof image picker in the request form when expanded', () => {
    const event = makeBaseEvent();
    event.status = 'ACTIVE';
    event.privacy_level = 'PROTECTED';
    event.viewer_context.participation_status = 'NONE';

    mockUseEventDetailViewModel.mockReturnValue(makeReadyViewModel(event));

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /request to join/i }));

    expect(screen.getByTestId('ed-request-image-pick')).toBeDefined();
  });

  it('renders a View Attachment link for host pending requests with image_url', () => {
    const event = makeBaseEvent();
    event.viewer_context = {
      is_host: true,
      is_favorited: false,
      participation_status: 'NONE',
    };
    const vm = makeReadyViewModel(event);
    vm.hostContextSummary = {
      approved_participant_count: 0,
      pending_join_request_count: 1,
      invitation_count: 0,
    };
    vm.pendingJoinRequests = [
      {
        join_request_id: 'jr-1',
        status: 'PENDING',
        message: 'I attended similar events.',
        image_url:
          'https://sem-bucket.fra1.cdn.digitaloceanspaces.com/events/x/join-requests/y/upload-id',
        created_at: '2026-04-02T10:00:00Z',
        updated_at: '2026-04-02T10:00:00Z',
        user: {
          id: 'requester-1',
          username: 'requester',
          display_name: 'Requester User',
          avatar_url: null,
          final_score: null,
          rating_count: 0,
        },
      },
    ];

    mockUseEventDetailViewModel.mockReturnValue(vm);

    renderPage();

    const link = screen.getByTestId('ed-mgmt-attachment-jr-1') as HTMLAnchorElement;
    expect(link).toBeDefined();
    expect(link.href).toContain('/join-requests/y/upload-id');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });

  it('does not render the attachment link when image_url is null', () => {
    const event = makeBaseEvent();
    event.viewer_context = {
      is_host: true,
      is_favorited: false,
      participation_status: 'NONE',
    };
    const vm = makeReadyViewModel(event);
    vm.hostContextSummary = {
      approved_participant_count: 0,
      pending_join_request_count: 1,
      invitation_count: 0,
    };
    vm.pendingJoinRequests = [
      {
        join_request_id: 'jr-2',
        status: 'PENDING',
        message: null,
        image_url: null,
        created_at: '2026-04-02T10:00:00Z',
        updated_at: '2026-04-02T10:00:00Z',
        user: {
          id: 'requester-2',
          username: 'requester2',
          display_name: null,
          avatar_url: null,
          final_score: null,
          rating_count: 0,
        },
      },
    ];

    mockUseEventDetailViewModel.mockReturnValue(vm);

    renderPage();

    expect(screen.queryByTestId('ed-mgmt-attachment-jr-2')).toBeNull();
  });

  it('shows a Cancel Request button only when the user has a pending request', () => {
    const event = makeBaseEvent();
    event.status = 'ACTIVE';
    event.privacy_level = 'PROTECTED';
    event.viewer_context.participation_status = 'PENDING';

    mockUseEventDetailViewModel.mockReturnValue(makeReadyViewModel(event));

    renderPage();

    expect(screen.getByTestId('ed-cancel-request-btn')).toBeDefined();
  });

  it('does not show a Cancel Request button for non-pending viewers', () => {
    const event = makeBaseEvent();
    event.status = 'ACTIVE';
    event.privacy_level = 'PROTECTED';
    event.viewer_context.participation_status = 'NONE';

    mockUseEventDetailViewModel.mockReturnValue(makeReadyViewModel(event));

    renderPage();

    expect(screen.queryByTestId('ed-cancel-request-btn')).toBeNull();
  });

  it('opens a confirmation modal and only calls handleCancelJoinRequest after confirming', () => {
    const event = makeBaseEvent();
    event.status = 'ACTIVE';
    event.privacy_level = 'PROTECTED';
    event.viewer_context.participation_status = 'PENDING';
    const vm = makeReadyViewModel(event);

    mockUseEventDetailViewModel.mockReturnValue(vm);

    renderPage();

    fireEvent.click(screen.getByTestId('ed-cancel-request-btn'));
    expect(vm.handleCancelJoinRequest).not.toHaveBeenCalled();

    expect(screen.getByText(/are you sure you want to withdraw/i)).toBeDefined();

    fireEvent.click(screen.getByTestId('ed-cancel-request-confirm'));
    expect(vm.handleCancelJoinRequest).toHaveBeenCalledTimes(1);
  });

  it('renders a dismissible error message when cancel fails', () => {
    const event = makeBaseEvent();
    event.status = 'ACTIVE';
    event.privacy_level = 'PROTECTED';
    event.viewer_context.participation_status = 'PENDING';
    const vm = makeReadyViewModel(event);
    vm.cancelJoinRequestError = 'Your request status changed. Please review the latest state of this event.';

    mockUseEventDetailViewModel.mockReturnValue(vm);

    renderPage();

    expect(screen.getByText(/your request status changed/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /dismiss error/i }));
    expect(vm.dismissCancelJoinRequestError).toHaveBeenCalled();
  });

  it('shows the View Ticket CTA for joined participants on public events', () => {
    const event = makeBaseEvent();
    event.status = 'ACTIVE';
    event.privacy_level = 'PUBLIC';
    event.viewer_context.participation_status = 'JOINED';

    mockUseEventDetailViewModel.mockReturnValue(makeReadyViewModel(event));

    renderPage();

    expect(screen.getByTestId('ed-view-ticket-cta')).toBeDefined();
  });

  it('shows the View Ticket CTA for joined participants on protected events', () => {
    const event = makeBaseEvent();
    event.status = 'ACTIVE';
    event.privacy_level = 'PROTECTED';
    event.viewer_context.participation_status = 'JOINED';

    mockUseEventDetailViewModel.mockReturnValue(makeReadyViewModel(event));

    renderPage();

    expect(screen.getByTestId('ed-view-ticket-cta')).toBeDefined();
  });

  it('shows the View Ticket CTA for joined participants on private events', () => {
    const event = makeBaseEvent();
    event.status = 'ACTIVE';
    event.privacy_level = 'PRIVATE';
    event.viewer_context.participation_status = 'JOINED';

    mockUseEventDetailViewModel.mockReturnValue(makeReadyViewModel(event));

    renderPage();

    expect(screen.getByTestId('ed-view-ticket-cta')).toBeDefined();
  });

  it('hides the View Ticket CTA for non-participants', () => {
    const event = makeBaseEvent();
    event.status = 'ACTIVE';
    event.privacy_level = 'PUBLIC';
    event.viewer_context.participation_status = 'NONE';

    mockUseEventDetailViewModel.mockReturnValue(makeReadyViewModel(event));

    renderPage();

    expect(screen.queryByTestId('ed-view-ticket-cta')).toBeNull();
  });

  it('hides the View Ticket CTA for completed or canceled events', () => {
    const event = makeBaseEvent();
    event.status = 'COMPLETED';
    event.privacy_level = 'PUBLIC';
    event.viewer_context.participation_status = 'JOINED';

    mockUseEventDetailViewModel.mockReturnValue(makeReadyViewModel(event));

    renderPage();

    expect(screen.queryByTestId('ed-view-ticket-cta')).toBeNull();
  });
});
