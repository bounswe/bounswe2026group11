/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { router } from 'expo-router';
import type { EventDetail } from '@/models/event';
import type { TicketScanViewModel } from '@/viewmodels/ticket/useTicketScanViewModel';
import { useTicketScanViewModel } from '@/viewmodels/ticket/useTicketScanViewModel';
import TicketScanView from './TicketScanView';

let cameraPermission = { granted: true, canAskAgain: true };
const mockRequestPermission = jest.fn();
let latestBarcodeHandler: ((payload: { data: string }) => void | Promise<void>) | undefined;

jest.mock('expo-camera', () => {
  const ReactLocal = require('react');
  return {
    CameraView: ({
      onBarcodeScanned,
    }: {
      onBarcodeScanned?: (payload: { data: string }) => void | Promise<void>;
    }) => {
      latestBarcodeHandler = onBarcodeScanned;
      return ReactLocal.createElement('div', { 'data-testid': 'camera-view' });
    },
    useCameraPermissions: () => [cameraPermission, mockRequestPermission],
  };
});

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

jest.mock('@/viewmodels/ticket/useTicketScanViewModel', () => ({
  useTicketScanViewModel: jest.fn(),
}));

const mockUseTicketScanViewModel = jest.mocked(useTicketScanViewModel);
const mockRouterBack = jest.mocked(router.back);

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
  overrides: Partial<TicketScanViewModel> = {},
): TicketScanViewModel {
  return {
    event: makeEvent(),
    qrToken: '',
    scanResult: null,
    isLoading: false,
    isSubmitting: false,
    errorMessage: null,
    isHost: true,
    setQrToken: jest.fn(),
    submit: jest.fn().mockResolvedValue(undefined),
    submitToken: jest.fn().mockResolvedValue(undefined),
    clearResult: jest.fn(),
    reload: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('TicketScanView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cameraPermission = { granted: true, canAskAgain: true };
    latestBarcodeHandler = undefined;
  });

  it('renders the loading state', () => {
    mockUseTicketScanViewModel.mockReturnValue(
      buildViewModel({ event: null, isLoading: true, isHost: false }),
    );

    render(<TicketScanView eventId="event-1" />);

    expect(screen.getByText('Loading scan tools...')).toBeTruthy();
  });

  it('renders an open failure with retry and back actions', () => {
    const reload = jest.fn().mockResolvedValue(undefined);
    mockUseTicketScanViewModel.mockReturnValue(
      buildViewModel({
        event: null,
        isHost: false,
        errorMessage: 'You must be logged in to scan tickets.',
        reload,
      }),
    );

    render(<TicketScanView eventId="event-1" />);

    expect(screen.getByText('Unable to open scanner')).toBeTruthy();
    expect(screen.getByText('You must be logged in to scan tickets.')).toBeTruthy();

    fireEvent.click(screen.getByText('Try Again'));
    fireEvent.click(screen.getByLabelText('Back'));

    expect(reload).toHaveBeenCalled();
    expect(mockRouterBack).toHaveBeenCalled();
  });

  it('blocks non-hosts from the scanner UI', () => {
    mockUseTicketScanViewModel.mockReturnValue(
      buildViewModel({
        event: makeEvent({
          viewer_context: {
            is_host: false,
            is_favorited: false,
            participation_status: 'JOINED',
          },
        }),
        isHost: false,
      }),
    );

    render(<TicketScanView eventId="event-1" />);

    expect(screen.getByText('Access Denied')).toBeTruthy();
    expect(screen.getByText(/Only the event host is authorized/)).toBeTruthy();
    expect(screen.queryByTestId('camera-view')).toBeNull();
  });

  it('renders a camera permission prompt and requests permission', () => {
    cameraPermission = { granted: false, canAskAgain: true };
    mockUseTicketScanViewModel.mockReturnValue(buildViewModel());

    render(<TicketScanView eventId="event-1" />);

    expect(screen.getByText('Camera access lets hosts scan tickets instantly.')).toBeTruthy();

    fireEvent.click(screen.getByText('Enable Camera'));

    expect(mockRequestPermission).toHaveBeenCalled();
    expect(screen.queryByTestId('camera-view')).toBeNull();
  });

  it('submits scanned QR data and pauses duplicate scan callbacks', async () => {
    const submitToken = jest.fn().mockResolvedValue(undefined);
    mockUseTicketScanViewModel.mockReturnValue(buildViewModel({ submitToken }));

    render(<TicketScanView eventId="event-1" />);

    expect(screen.getByTestId('camera-view')).toBeTruthy();
    expect(latestBarcodeHandler).toBeDefined();

    await act(async () => {
      await latestBarcodeHandler?.({ data: 'qr-token-1' });
      await latestBarcodeHandler?.({ data: 'qr-token-2' });
    });

    await waitFor(() => expect(submitToken).toHaveBeenCalledWith('qr-token-1'));
    expect(submitToken).toHaveBeenCalledTimes(1);
  });

  it('shows an accepted scan result and clears it when scanning another ticket', () => {
    const clearResult = jest.fn();
    mockUseTicketScanViewModel.mockReturnValue(
      buildViewModel({
        clearResult,
        scanResult: {
          result: 'ACCEPTED',
          ticket_id: 'ticket-1',
          participation_id: 'participation-1',
          user_id: 'user-1',
          ticket_status: 'USED',
        },
      }),
    );

    render(<TicketScanView eventId="event-1" />);

    expect(screen.getByText('Ticket accepted')).toBeTruthy();
    expect(screen.getByText('The attendee can enter the event.')).toBeTruthy();
    expect(screen.getByText('Used')).toBeTruthy();

    fireEvent.click(screen.getByText('Scan Another Ticket'));

    expect(clearResult).toHaveBeenCalled();
  });
});
