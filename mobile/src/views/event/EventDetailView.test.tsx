/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { EventDetail } from '@/models/event';
import type { EventDetailViewModel } from '@/viewmodels/event/useEventDetailViewModel';
import EventDetailView from './EventDetailView';
import { useEventDetailViewModel } from '@/viewmodels/event/useEventDetailViewModel';

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactLocal = require('react');
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      ReactLocal.createElement('div', null, children),
    useSafeAreaInsets: () => ({ top: 44, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('@expo/vector-icons', () => {
  const ReactLocal = require('react');

  function createIconComponent(library: string) {
    return ({ name }: { name: string }) =>
      ReactLocal.createElement('span', {
        'data-icon-library': library,
        'data-icon': name,
      });
  }

  return {
    Feather: createIconComponent('feather'),
    Ionicons: createIconComponent('ionicons'),
    MaterialIcons: createIconComponent('material-icons'),
  };
});

jest.mock('@/components/events/JoinRequestsModal', () => () => null);
jest.mock('@/components/events/ParticipantListModal', () => () => null);
jest.mock('@/components/events/InvitationsModal', () => () => null);
jest.mock('@/components/events/EventDiscussionSection', () => () => null);

jest.mock('@/viewmodels/event/useEventDetailViewModel', () => ({
  useEventDetailViewModel: jest.fn(),
}));

jest.mock('@/viewmodels/event/useEventDiscussionViewModel', () => ({
  useEventDiscussionViewModel: jest.fn(() => ({
    discussions: { items: [], nextCursor: null, hasNext: false, loading: false },
    reviews: { items: [], nextCursor: null, hasNext: false, loading: false },
    repliesMap: {},
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
    loadMoreDiscussions: jest.fn(),
    loadMoreReviews: jest.fn(),
    loadReplies: jest.fn(),
    loadMoreReplies: jest.fn(),
    submitDiscussionComment: jest.fn(),
    submitReply: jest.fn(),
    submitReview: jest.fn(),
    dismissDiscussionError: jest.fn(),
    dismissReviewError: jest.fn(),
    refresh: jest.fn(),
  })),
}));

const mockUseEventDetailViewModel = jest.mocked(useEventDetailViewModel);

function makeEvent(overrides: Partial<EventDetail> = {}): EventDetail {
  return {
    id: 'event-1',
    title: 'Protected Meetup',
    description: 'Members-only event',
    image_url: null,
    privacy_level: 'PROTECTED',
    status: 'ACTIVE',
    start_time: '2026-05-02T19:00:00+03:00',
    end_time: '2026-05-02T21:00:00+03:00',
    capacity: 20,
    minimum_age: null,
    preferred_gender: null,
    approved_participant_count: 4,
    pending_participant_count: 1,
    favorite_count: 2,
    created_at: '2026-04-01T12:00:00+03:00',
    updated_at: '2026-04-01T12:00:00+03:00',
    category: { id: 3, name: 'Social' },
    host: {
      id: 'host-1',
      username: 'hostuser',
      display_name: 'Host User',
      avatar_url: null,
    },
    host_score: {
      final_score: 4.6,
      hosted_event_rating_count: 8,
    },
    location: {
      type: 'POINT',
      address: 'Kadikoy, Istanbul',
      point: { lat: 40.99, lon: 29.03 },
      route_points: [],
    },
    tags: ['social'],
    constraints: [],
    rating_window: {
      opens_at: '2026-05-02T21:00:00+03:00',
      closes_at: '2026-05-09T21:00:00+03:00',
      is_active: false,
    },
    viewer_event_rating: null,
    viewer_context: {
      is_host: false,
      is_favorited: false,
      participation_status: 'PENDING',
    },
    host_context: null,
    ...overrides,
  };
}

function buildViewModel(
  overrides: Partial<EventDetailViewModel> = {},
): EventDetailViewModel {
  return {
    event: makeEvent(),
    hostContextSummary: null,
    approvedParticipants: [],
    pendingJoinRequests: [],
    approvedParticipantsLoading: false,
    pendingJoinRequestsLoading: false,
    approvedParticipantsHasNext: false,
    pendingJoinRequestsHasNext: false,
    isLoading: false,
    apiError: null,
    actionError: null,
    actionState: 'idle',
    isFavorited: false,
    participationStatus: 'PENDING',
    isQuotaFull: false,
    constraintViolation: null,
    viewerRatingLoading: false,
    viewerRatingError: null,
    participantRatingLoadingId: null,
    participantRatingError: null,
    showJoinRequestModal: false,
    joinRequestMessage: '',
    selectedImageUri: null,
    isUploadingImage: false,
    imageError: null,
    openJoinRequestModal: jest.fn(),
    closeJoinRequestModal: jest.fn(),
    pickImage: jest.fn().mockResolvedValue(undefined),
    removeImage: jest.fn(),
    setJoinRequestMessage: jest.fn(),
    canLeave: false,
    handleJoin: jest.fn().mockResolvedValue(undefined),
    handleLeaveEvent: jest.fn().mockResolvedValue(undefined),
    handleRequestJoin: jest.fn().mockResolvedValue(undefined),
    handleAcceptInvitation: jest.fn().mockResolvedValue(undefined),
    handleDeclineInvitation: jest.fn().mockResolvedValue(undefined),
    handleToggleFavorite: jest.fn().mockResolvedValue(undefined),
    handleViewerRatingSubmit: jest.fn().mockResolvedValue(undefined),
    handleParticipantRatingSubmit: jest.fn().mockResolvedValue(undefined),
    dismissViewerRatingError: jest.fn(),
    dismissParticipantRatingError: jest.fn(),
    retry: jest.fn(),
    showRequestsModal: false,
    setShowRequestsModal: jest.fn(),
    showAttendeesModal: false,
    setShowAttendeesModal: jest.fn(),
    loadMoreApprovedParticipants: jest.fn().mockResolvedValue(undefined),
    loadMorePendingJoinRequests: jest.fn().mockResolvedValue(undefined),
    handleApproveRequest: jest.fn().mockResolvedValue(undefined),
    handleRejectRequest: jest.fn().mockResolvedValue(undefined),
    handleCancelEvent: jest.fn().mockResolvedValue(undefined),
    showInvitationsModal: false,
    setShowInvitationsModal: jest.fn(),
    invitations: [],
    invitationsLoading: false,
    invitationsHasNext: false,
    loadMoreInvitations: jest.fn().mockResolvedValue(undefined),
    handleInviteUsers: jest.fn().mockResolvedValue(undefined),
    isInviting: false,
    userSearchQuery: '',
    setUserSearchQuery: jest.fn(),
    userSuggestions: [],
    isSearchingUsers: false,
    handleCancelJoinRequest: jest.fn().mockResolvedValue(undefined),
    handleRevokeInvitation: jest.fn().mockResolvedValue(undefined),
    showReportModal: false,
    setShowReportModal: jest.fn(),
    reportCategory: null,
    setReportCategory: jest.fn(),
    reportMessage: '',
    setReportMessage: jest.fn(),
    reportImageUri: null,
    pickReportImage: jest.fn().mockResolvedValue(undefined),
    removeReportImage: jest.fn(),
    handleReportEvent: jest.fn().mockResolvedValue(undefined),
    canAttachReportImage: false,
    token: 'mock-token',
    user: null,
    ...overrides,
  };
}

describe('EventDetailView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the pending join-request chip and hides the request button', () => {
    mockUseEventDetailViewModel.mockReturnValue(buildViewModel());

    render(<EventDetailView eventId="event-1" />);

    expect(screen.getByText('Request sent — awaiting approval')).toBeTruthy();
    expect(screen.queryByText('Request to Join')).toBeNull();
  });

  it('shows the inaccessible state when apiError mentions private or missing events', () => {
    mockUseEventDetailViewModel.mockReturnValue(
      buildViewModel({
        event: null,
        apiError: 'This event is private and only accessible to invited guests. If you don\'t have a valid invitation or if you have previously declined one, you cannot view the details.',
      }),
    );

    render(<EventDetailView eventId="event-1" />);

    expect(screen.getByText('Event Inaccessible')).toBeTruthy();
    expect(screen.getByText(/If you don't have a valid invitation/)).toBeTruthy();
    expect(screen.getByText('Go Back to Discovery')).toBeTruthy();
    
    // Check for the lock icon
    const lockIcon = screen.getByTestId('error-icon-lock');
    expect(lockIcon).toBeTruthy();
  });

  it('hides the Invite & Manage button for non-host users on private events', () => {
    const privateEvent = makeEvent({ privacy_level: 'PRIVATE', viewer_context: { is_host: false, is_favorited: false, participation_status: 'NONE' } });
    mockUseEventDetailViewModel.mockReturnValue(buildViewModel({ event: privateEvent }));

    render(<EventDetailView eventId="event-1" />);

    expect(screen.queryByText('Invite & Manage')).toBeNull();
  });

  it('renders the map and Get Directions button when location coordinates are available', () => {
    const eventWithLocation = makeEvent();
    mockUseEventDetailViewModel.mockReturnValue(buildViewModel({ event: eventWithLocation }));

    render(<EventDetailView eventId="event-1" />);

    expect(screen.getByText('Get Directions')).toBeTruthy();
  });

  it('does not render the map when location coordinates are missing', () => {
    const eventWithoutLocation = makeEvent({
      location: { type: 'POINT', address: 'Unknown', point: null, route_points: [] },
    });
    mockUseEventDetailViewModel.mockReturnValue(buildViewModel({ event: eventWithoutLocation }));

    render(<EventDetailView eventId="event-1" />);

    expect(screen.queryByText('Get Directions')).toBeNull();
  });

  // ── approximate-location UX ────────────────────────────────────────────────

  it('shows approximate-location banner and hides Get Directions for PROTECTED non-participant', () => {
    const approxEvent = makeEvent({
      privacy_level: 'PROTECTED',
      location: { type: 'POINT', address: 'Kadikoy, Istanbul', point: { lat: 40.99, lon: 29.03 }, route_points: [], is_location_approximate: true },
      viewer_context: {
        is_host: false,
        is_favorited: false,
        participation_status: 'NONE',
      },
    });
    mockUseEventDetailViewModel.mockReturnValue(
      buildViewModel({ event: approxEvent, participationStatus: 'NONE' }),
    );

    render(<EventDetailView eventId="event-1" />);

    expect(screen.getByTestId('approx-map-callout')).toBeTruthy();
    expect(screen.getByText("You're seeing an approximate location")).toBeTruthy();
    expect(screen.queryByText('Get Directions')).toBeNull();
  });

  it('hides the approximate-location callout and shows Get Directions for an approved participant', () => {
    const exactEvent = makeEvent({
      privacy_level: 'PROTECTED',
      location: { type: 'POINT', address: 'Kadikoy, Istanbul', point: { lat: 40.99, lon: 29.03 }, route_points: [], is_location_approximate: false },
      viewer_context: {
        is_host: false,
        is_favorited: false,
        participation_status: 'JOINED',
      },
    });
    mockUseEventDetailViewModel.mockReturnValue(
      buildViewModel({ event: exactEvent, participationStatus: 'JOINED' }),
    );

    render(<EventDetailView eventId="event-1" />);

    expect(screen.queryByTestId('approx-map-callout')).toBeNull();
    expect(screen.getByText('Get Directions')).toBeTruthy();
  });

  it('hides approximate-location callout for the event host', () => {
    const hostEvent = makeEvent({
      privacy_level: 'PROTECTED',
      location: { type: 'POINT', address: 'Kadikoy, Istanbul', point: { lat: 40.99, lon: 29.03 }, route_points: [], is_location_approximate: false },
      viewer_context: {
        is_host: true,
        is_favorited: false,
        participation_status: 'NONE',
      },
    });
    mockUseEventDetailViewModel.mockReturnValue(
      buildViewModel({ event: hostEvent }),
    );

    render(<EventDetailView eventId="event-1" />);

    expect(screen.queryByTestId('approx-map-callout')).toBeNull();
  });

  it('shows approximate-location callout for a pending-request viewer', () => {
    const pendingEvent = makeEvent({
      privacy_level: 'PROTECTED',
      location: { type: 'POINT', address: 'Kadikoy, Istanbul', point: { lat: 40.99, lon: 29.03 }, route_points: [], is_location_approximate: true },
      viewer_context: {
        is_host: false,
        is_favorited: false,
        participation_status: 'PENDING',
      },
    });
    mockUseEventDetailViewModel.mockReturnValue(
      buildViewModel({ event: pendingEvent, participationStatus: 'PENDING' }),
    );

    render(<EventDetailView eventId="event-1" />);

    expect(screen.getByTestId('approx-map-callout')).toBeTruthy();
    expect(screen.queryByText('Get Directions')).toBeNull();
  });

  it('renders meeting instructions when available', () => {
    const eventWithInstructions = makeEvent({
      location: {
        type: 'POINT',
        address: 'Kadikoy',
        point: { lat: 40.99, lon: 29.03 },
        meeting_instructions: 'Wait at the statue',
        route_points: [],
      },
    });
    mockUseEventDetailViewModel.mockReturnValue(buildViewModel({ event: eventWithInstructions }));

    render(<EventDetailView eventId="event-1" />);

    expect(screen.getByText('Meeting Instructions')).toBeTruthy();
    expect(screen.getByText('Wait at the statue')).toBeTruthy();
  });

  it('shows accept and decline actions for invited users', () => {
    const handleAcceptInvitation = jest.fn().mockResolvedValue(undefined);
    const handleDeclineInvitation = jest.fn().mockResolvedValue(undefined);
    const invitedEvent = makeEvent({
      privacy_level: 'PRIVATE',
      viewer_context: {
        is_host: false,
        is_favorited: false,
        participation_status: 'INVITED',
      },
    });

    mockUseEventDetailViewModel.mockReturnValue(
      buildViewModel({
        event: invitedEvent,
        participationStatus: 'INVITED',
        handleAcceptInvitation,
        handleDeclineInvitation,
      }),
    );

    render(<EventDetailView eventId="event-1" />);

    fireEvent.click(screen.getByText('Accept Invitation'));
    fireEvent.click(screen.getByText('Decline'));

    expect(handleAcceptInvitation).toHaveBeenCalledTimes(1);
    expect(handleDeclineInvitation).toHaveBeenCalledTimes(1);
  });

  it('renders a Directions to Start button and a Route chip for ROUTE events', () => {
    const routeEvent = makeEvent({
      location: {
        type: 'ROUTE',
        address: 'Galata Tower → Hagia Sophia',
        point: null,
        route_points: [
          { lat: 41.04, lon: 29.0 },
          { lat: 41.05, lon: 29.02 },
          { lat: 41.06, lon: 29.04 },
        ],
      },
    });
    mockUseEventDetailViewModel.mockReturnValue(buildViewModel({ event: routeEvent }));

    render(<EventDetailView eventId="event-1" />);

    expect(screen.getByText('Directions to Start')).toBeTruthy();
    expect(screen.queryByText('Get Directions')).toBeNull();
    expect(screen.getByText('Galata Tower → Hagia Sophia')).toBeTruthy();
    expect(screen.getByText('Route')).toBeTruthy();
  });

  it('does not render the map for a ROUTE event with no waypoints', () => {
    const routeEventNoPoints = makeEvent({
      location: {
        type: 'ROUTE',
        address: 'Empty route',
        point: null,
        route_points: [],
      },
    });
    mockUseEventDetailViewModel.mockReturnValue(
      buildViewModel({ event: routeEventNoPoints }),
    );

    render(<EventDetailView eventId="event-1" />);

    expect(screen.queryByText('Get Directions')).toBeNull();
    expect(screen.queryByText('Directions to Start')).toBeNull();
  });
});
