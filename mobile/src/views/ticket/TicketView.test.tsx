/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import type { TicketViewModel } from '@/viewmodels/ticket/useTicketViewModel';
import { lightTheme } from '@/theme/themes';
import TicketView from './TicketView';
import { useTicketViewModel } from '@/viewmodels/ticket/useTicketViewModel';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
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

jest.mock('@/theme', () => ({
  useTheme: () => ({
    theme: lightTheme,
    isDark: false,
  }),
}));

jest.mock('@/components/ticket/DecorativeQrCode', () => {
  const ReactLocal = require('react');
  return ({ size, value }: { size?: number; value: string }) =>
    ReactLocal.createElement(
      'div',
      {
        'data-testid': 'decorative-qr',
        'data-size': String(size ?? ''),
      },
      value,
    );
});

jest.mock('@/components/ticket/CircularTimer', () => {
  const ReactLocal = require('react');
  return ({ remaining }: { remaining: number }) =>
    ReactLocal.createElement('div', { 'data-testid': 'circular-timer' }, `Remaining: ${remaining}`);
});

jest.mock('@/viewmodels/ticket/useTicketViewModel', () => ({
  useTicketViewModel: jest.fn(),
}));

const mockUseTicketViewModel = jest.mocked(useTicketViewModel);

function buildViewModel(overrides: Partial<TicketViewModel> = {}): TicketViewModel {
  return {
    ticket: {
      ticket: {
        id: 'ticket-1',
        status: 'ACTIVE',
        expires_at: '2026-05-15T20:00:00Z',
        created_at: '2026-05-10T12:00:00Z',
        updated_at: '2026-05-10T12:00:00Z',
      },
      participation: {
        id: 'participation-1',
        status: 'APPROVED',
      },
      event: {
        id: 'event-1',
        title: 'Private House Party',
        status: 'ACTIVE',
        privacy_level: 'PRIVATE',
        start_time: '2026-05-15T19:45:00Z',
        end_time: '2026-05-16T01:30:00Z',
        location_type: 'POINT',
        address: 'Tesvikiye Mahallesi, Sisli',
      },
      location: {
        type: 'POINT',
        address: 'Tesvikiye Mahallesi, Sisli',
        anchor_lat: 41.0485,
        anchor_lon: 28.9927,
      },
      qr_access: {
        requires_location_permission: true,
        requires_proximity: true,
        proximity_meters: 200,
        eligible_now: true,
        reason: null,
      },
    },
    eventImageUrl: null,
    qrToken: {
      token: 'live-qr-token',
      expires_at: '2026-05-10T12:00:10.000Z',
      version: 1,
    },
    isLoading: false,
    apiError: null,
    qrMessage: null,
    isActionLoading: false,
    secondsRemaining: 10,
    refresh: jest.fn().mockResolvedValue(undefined),
    resetError: jest.fn(),
    ...overrides,
  };
}

describe('TicketView', () => {
  beforeEach(() => {
    mockUseTicketViewModel.mockReturnValue(buildViewModel());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders a larger 260px QR code and a circular timer', () => {
    render(<TicketView ticketId="ticket-1" />);

    expect(screen.getByTestId('decorative-qr').getAttribute('data-size')).toBe('260');
    expect(screen.getByTestId('circular-timer')).toBeTruthy();
    expect(screen.getByText('Remaining: 10')).toBeTruthy();
  });

  it('shows a refreshing indicator when secondsRemaining reaches 0', () => {
    mockUseTicketViewModel.mockReturnValue(buildViewModel({
      secondsRemaining: 0
    }));
    
    render(<TicketView ticketId="ticket-1" />);

    expect(screen.getByTestId('qr-refreshing-indicator')).toBeTruthy();
  });

  it('shows error panel when apiError exists', () => {
    mockUseTicketViewModel.mockReturnValue(buildViewModel({
      apiError: 'Network failure'
    }));
    
    render(<TicketView ticketId="ticket-1" />);

    expect(screen.getByText('Network failure')).toBeTruthy();
  });
});
