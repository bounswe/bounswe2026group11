/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { router } from 'expo-router';
import type { EventDetail } from '@/models/event';
import type { EventActionsViewModel } from '@/viewmodels/ticket/useEventActionsViewModel';
import { useEventActionsViewModel } from '@/viewmodels/ticket/useEventActionsViewModel';
import EventActionsView from './EventActionsView';

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
      ReactLocal.createElement('span', {
        'data-icon-library': library,
        'data-icon': name,
      });
  }

  return {
    Feather: createIconComponent('feather'),
    Ionicons: createIconComponent('ionicons'),
  };
});

jest.mock('@/components/events/EventCategoryChip', () => {
  const ReactLocal = require('react');
  return {
    __esModule: true,
    default: ({ categoryName }: { categoryName: string }) =>
      ReactLocal.createElement('span', null, `category:${categoryName}`),
  };
});

jest.mock('@/viewmodels/ticket/useEventActionsViewModel', () => ({
  useEventActionsViewModel: jest.fn(),
}));

const mockUseEventActionsViewModel = jest.mocked(useEventActionsViewModel);
const mockRouterBack = jest.mocked(router.back);
const mockRouterPush = jest.mocked(router.push);

function makeEvent(overrides: Partial<EventDetail> = {}): EventDetail {
  return {
    id: 'event-1',
    title: 'Ticketed Meetup',
    description: 'Bring your ticket.',
    image_url: null,
    privacy_level: 'PROTECTED',
    status: 'ACTIVE',
    start_time: '2030-05-12T18:00:00+03:00',
    end_time: '2030-05-12T20:00:00+03:00',
    capacity: 30,
    minimum_age: null,
    preferred_gender: null,
    approved_participant_count: 12,
    pending_participant_count: 0,
    favorite_count: 4,
    created_at: '2030-04-01T12:00:00+03:00',
    updated_at: '2030-04-02T12:00:00+03:00',
    category: { id: 2, name: 'Social' },
    host: {
      id: 'host-1',
      username: 'hostuser',
      display_name: 'Host User',
      avatar_url: null,
    },
    host_score: {
      final_score: 4.8,
      hosted_event_rating_count: 9,
    },
    location: {
      type: 'POINT',
      address: 'Kadikoy, Istanbul',
      point: { lat: 40.99, lon: 29.03 },
      route_points: [],
    },
    tags: [],
    constraints: [],
    rating_window: {
      opens_at: '2030-05-12T20:00:00+03:00',
      closes_at: '2030-05-19T20:00:00+03:00',
      is_active: false,
    },
    viewer_event_rating: null,
    viewer_context: {
      is_host: true,
      is_favorited: false,
      participation_status: 'JOINED',
    },
    host_context: null,
    ...overrides,
  };
}

function buildViewModel(
  overrides: Partial<EventActionsViewModel> = {},
): EventActionsViewModel {
  return {
    event: makeEvent(),
    ticket: null,
    isLoading: false,
    errorMessage: null,
    primaryActionLabel: 'Scan Ticket',
    canOpenTicket: false,
    canScanTicket: true,
    canEditEvent: true,
    reload: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('EventActionsView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the loading state', () => {
    mockUseEventActionsViewModel.mockReturnValue(
      buildViewModel({ event: null, isLoading: true, primaryActionLabel: null, canScanTicket: false, canEditEvent: false }),
    );

    render(<EventActionsView eventId="event-1" />);

    expect(screen.getByText('Loading event details...')).toBeTruthy();
  });

  it('renders an error state with retry and back actions', () => {
    const reload = jest.fn().mockResolvedValue(undefined);
    mockUseEventActionsViewModel.mockReturnValue(
      buildViewModel({
        event: null,
        errorMessage: 'Failed to load event actions.',
        primaryActionLabel: null,
        canScanTicket: false,
        canEditEvent: false,
        reload,
      }),
    );

    render(<EventActionsView eventId="event-1" />);

    expect(screen.getByText('Unable to open this event')).toBeTruthy();
    expect(screen.getByText('Failed to load event actions.')).toBeTruthy();

    fireEvent.click(screen.getByText('Try Again'));
    fireEvent.click(screen.getByLabelText('Back'));

    expect(reload).toHaveBeenCalled();
    expect(mockRouterBack).toHaveBeenCalled();
  });

  it('lets hosts open scanner, edit event, view full event, and open host profile', () => {
    mockUseEventActionsViewModel.mockReturnValue(buildViewModel());

    render(<EventActionsView eventId="event-1" />);

    expect(screen.getByText('Ticketed Meetup')).toBeTruthy();
    expect(screen.getByText('category:Social')).toBeTruthy();
    expect(screen.getByText('12 participants / 30')).toBeTruthy();

    fireEvent.click(screen.getByText('Scan Ticket'));
    fireEvent.click(screen.getByText('Edit Event'));
    fireEvent.click(screen.getByText('View Full Event'));
    fireEvent.click(screen.getByText('Host User'));

    expect(mockRouterPush).toHaveBeenCalledWith('/event/event-1/scan-ticket');
    expect(mockRouterPush).toHaveBeenCalledWith('/event/event-1/edit');
    expect(mockRouterPush).toHaveBeenCalledWith('/event/event-1');
    expect(mockRouterPush).toHaveBeenCalledWith('/user/host-1');
  });

  it('lets attendees open their ticket when a ticket is available', () => {
    mockUseEventActionsViewModel.mockReturnValue(
      buildViewModel({
        ticket: {
          ticket_id: 'ticket-1',
          status: 'ACTIVE',
          expires_at: '2030-05-12T21:00:00+03:00',
          event: {
            id: 'event-1',
            title: 'Ticketed Meetup',
            status: 'ACTIVE',
            privacy_level: 'PROTECTED',
            start_time: '2030-05-12T18:00:00+03:00',
            end_time: '2030-05-12T20:00:00+03:00',
            location_type: 'POINT',
            address: 'Kadikoy, Istanbul',
          },
          participation: {
            id: 'participation-1',
            status: 'APPROVED',
          },
        },
        primaryActionLabel: 'View Ticket',
        canOpenTicket: true,
        canScanTicket: false,
        canEditEvent: false,
      }),
    );

    render(<EventActionsView eventId="event-1" />);

    fireEvent.click(screen.getByText('View Ticket'));

    expect(mockRouterPush).toHaveBeenCalledWith('/ticket/ticket-1');
  });
});
