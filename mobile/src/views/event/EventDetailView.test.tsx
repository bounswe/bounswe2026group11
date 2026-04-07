/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import type { EventDetail } from '@/models/event';
import type { EventDetailViewModel } from '@/viewmodels/event/useEventDetailViewModel';
import EventDetailView from './EventDetailView';
import { useEventDetailViewModel } from '@/viewmodels/event/useEventDetailViewModel';

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
  };
});

jest.mock('@expo/vector-icons', () => {
  const ReactLocal = require('react');

  function createIconComponent(library: string) {
    return ({ name }: { name: string }) =>
      ReactLocal.createElement('span', { 'data-icon-library': library, 'data-icon': name });
  }

  return {
    Feather: createIconComponent('feather'),
    Ionicons: createIconComponent('ionicons'),
    MaterialIcons: createIconComponent('material-icons'),
  };
});

jest.mock('@/components/events/JoinRequestsModal', () => () => null);
jest.mock('@/components/events/ParticipantListModal', () => () => null);

jest.mock('@/viewmodels/event/useEventDetailViewModel', () => ({
  useEventDetailViewModel: jest.fn(),
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
    ...overrides,
  };
}

function buildViewModel(overrides: Partial<EventDetailViewModel> = {}): EventDetailViewModel {
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
    showJoinRequestModal: false,
    joinRequestMessage: '',
    openJoinRequestModal: jest.fn(),
    closeJoinRequestModal: jest.fn(),
    setJoinRequestMessage: jest.fn(),
    canLeave: false,
    handleJoin: jest.fn().mockResolvedValue(undefined),
    handleLeaveEvent: jest.fn().mockResolvedValue(undefined),
    handleRequestJoin: jest.fn().mockResolvedValue(undefined),
    handleToggleFavorite: jest.fn().mockResolvedValue(undefined),
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
});
