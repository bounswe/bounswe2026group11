/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { formatEventDateLabel } from '@/utils/eventDate';
import type { MyEventSummary } from '@/models/event';
import type { MyEventsViewModel } from '@/viewmodels/event/useMyEventsViewModel';
import MyEventsView from './MyEventsView';
import { useMyEventsViewModel } from '@/viewmodels/event/useMyEventsViewModel';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
  usePathname: () => '/events',
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

  function createIconComponent(name: string) {
    return ({ name: iconName }: { name: string }) =>
      ReactLocal.createElement('span', { 'data-icon-library': name, 'data-icon': iconName });
  }

  return {
    Feather: createIconComponent('feather'),
    MaterialIcons: createIconComponent('material'),
  };
});

jest.mock('@/viewmodels/event/useMyEventsViewModel', () => ({
  useMyEventsViewModel: jest.fn(),
}));

const mockUseMyEventsViewModel = jest.mocked(useMyEventsViewModel);

function makeEvent(overrides: Partial<MyEventSummary> = {}): MyEventSummary {
  return {
    id: 'event-1',
    title: 'Bosphorus Sunrise Run',
    image_url: null,
    start_time: '2026-04-08T07:00:00+03:00',
    end_time: '2026-04-08T09:00:00+03:00',
    location_address: 'Bebek Sahili, Istanbul, Turkey',
    approved_participant_count: 18,
    status: 'ACTIVE',
    relation: 'HOSTING',
    badges: [{ type: 'HOST', label: 'Host' }],
    ...overrides,
  };
}

function buildViewModel(
  overrides: Partial<MyEventsViewModel> = {},
): MyEventsViewModel {
  const hostedEvents = [makeEvent()];
  const attendedEvents = [
    makeEvent({
      id: 'event-2',
      title: 'Museum Late Hours Tour',
      status: 'COMPLETED',
      relation: 'ATTENDING',
      badges: [{ type: 'TICKET', label: 'Ticket' }],
    }),
  ];

  return {
    activeStatus: 'ACTIVE',
    statusTabs: [
      { value: 'ACTIVE', label: 'Active', count: 1 },
      { value: 'IN_PROGRESS', label: 'In Progress', count: 0 },
      { value: 'COMPLETED', label: 'Completed', count: 1 },
      { value: 'CANCELED', label: 'Canceled', count: 0 },
    ],
    hostedEvents,
    attendedEvents,
    visibleEvents: hostedEvents,
    hostedCount: hostedEvents.length,
    attendedCount: attendedEvents.length,
    isLoading: false,
    errorMessage: null,
    canRetry: true,
    emptyTitle: 'No active events right now',
    emptySubtitle: 'Hosted plans and upcoming participations will appear here.',
    setActiveStatus: jest.fn(),
    reload: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('MyEventsView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the my events page and event cards', () => {
    const event = makeEvent();
    mockUseMyEventsViewModel.mockReturnValue(
      buildViewModel({
        visibleEvents: [event],
      }),
    );

    render(<MyEventsView />);

    expect(screen.getByText('My Events')).toBeTruthy();
    expect(screen.getByText('Hosting')).toBeTruthy();
    expect(screen.getByText('Attending')).toBeTruthy();
    expect(screen.getByText('Bosphorus Sunrise Run')).toBeTruthy();
    expect(
      screen.getByText(formatEventDateLabel(event.start_time)),
    ).toBeTruthy();
    expect(screen.getByText('Bebek Sahili, Istanbul')).toBeTruthy();
    expect(screen.getByText('Host')).toBeTruthy();
  });

  it('updates the selected status tab when a segment is pressed', () => {
    const setActiveStatus = jest.fn();
    mockUseMyEventsViewModel.mockReturnValue(
      buildViewModel({ setActiveStatus }),
    );

    render(<MyEventsView />);

    fireEvent.click(screen.getByLabelText('Show Completed events'));

    expect(setActiveStatus).toHaveBeenCalledWith('COMPLETED');
  });

  it('renders the empty state for the selected status', () => {
    mockUseMyEventsViewModel.mockReturnValue(
      buildViewModel({
        visibleEvents: [],
        emptyTitle: 'No completed events yet',
        emptySubtitle: 'Your hosted wrap-ups and participation history will build here.',
      }),
    );

    render(<MyEventsView />);

    expect(screen.getByText('No completed events yet')).toBeTruthy();
    expect(
      screen.getByText('Your hosted wrap-ups and participation history will build here.'),
    ).toBeTruthy();
  });

  it('shows summary fallbacks when /me does not provide location or attendee count', () => {
    mockUseMyEventsViewModel.mockReturnValue(
      buildViewModel({
        visibleEvents: [
          makeEvent({
            location_address: null,
            approved_participant_count: null,
          }),
        ],
      }),
    );

    render(<MyEventsView />);

    expect(screen.getByText('Location available on event page')).toBeTruthy();
    expect(screen.getByText('N/A')).toBeTruthy();
  });

  it('renders a retryable error state', () => {
    const reload = jest.fn().mockResolvedValue(undefined);
    mockUseMyEventsViewModel.mockReturnValue(
      buildViewModel({
        errorMessage: 'Failed to load your events. Please try again.',
        visibleEvents: [],
        reload,
      }),
    );

    render(<MyEventsView />);

    expect(screen.getByText('Unable to load your events')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Try again'));

    expect(reload).toHaveBeenCalled();
  });
});
