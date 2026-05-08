// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { TicketDetailResponse } from '@/models/ticket';
import TicketDetailPage from './TicketDetailPage';

const mockUseTicketDetailViewModel = vi.fn();

vi.mock('@/viewmodels/tickets/useTicketDetailViewModel', () => ({
  useTicketDetailViewModel: (...args: unknown[]) =>
    mockUseTicketDetailViewModel(...args),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeDetail(overrides: Partial<TicketDetailResponse> = {}): TicketDetailResponse {
  return {
    ticket: {
      id: 'ticket-1',
      status: 'ACTIVE',
      expires_at: '2026-06-01T20:00:00Z',
      created_at: '2026-05-30T10:00:00Z',
      updated_at: '2026-05-30T10:00:00Z',
    },
    participation: {
      id: 'participation-1',
      status: 'APPROVED',
    },
    event: {
      id: 'event-1',
      title: 'Sunset Walk',
      status: 'ACTIVE',
      privacy_level: 'PROTECTED',
      start_time: '2026-06-01T18:00:00Z',
      end_time: null,
      location_type: 'POINT',
      address: 'Moda Coast',
    },
    location: {
      type: 'POINT',
      address: 'Moda Coast',
      anchor_lat: 40.98,
      anchor_lon: 29.03,
    },
    qr_access: {
      requires_location_permission: true,
      requires_proximity: true,
      proximity_meters: 200,
      eligible_now: true,
    },
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/tickets/ticket-1']}>
      <Routes>
        <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TicketDetailPage', () => {
  it('renders ticket info, status, and the mobile QR hint for an active ticket', () => {
    mockUseTicketDetailViewModel.mockReturnValue({
      ticket: makeDetail(),
      status: 'ready',
      errorMessage: null,
      refresh: vi.fn(),
    });
    renderPage();

    expect(screen.getByTestId('ticket-detail')).toBeDefined();
    expect(screen.getByText('Sunset Walk')).toBeDefined();
    expect(screen.getByText('Active')).toBeDefined();
    expect(screen.getByText(/show your qr on mobile/i)).toBeDefined();
    expect(screen.getByText(/open the social event mapper mobile app/i)).toBeDefined();
  });

  it('shows the eligibility notice when the active ticket cannot issue a QR right now', () => {
    const detail = makeDetail();
    detail.qr_access = {
      ...detail.qr_access,
      eligible_now: false,
      reason: 'OUTSIDE_PROXIMITY',
    };
    mockUseTicketDetailViewModel.mockReturnValue({
      ticket: detail,
      status: 'ready',
      errorMessage: null,
      refresh: vi.fn(),
    });
    renderPage();
    expect(screen.getByText(/eligibility note/i)).toBeDefined();
    expect(screen.getByText(/OUTSIDE_PROXIMITY/i)).toBeDefined();
  });

  it('hides the mobile QR hint for non-active tickets (USED, EXPIRED, CANCELED)', () => {
    const detail = makeDetail({
      ticket: {
        id: 'ticket-1',
        status: 'USED',
        expires_at: '2026-06-01T20:00:00Z',
        used_at: '2026-06-01T18:30:00Z',
        created_at: '2026-05-30T10:00:00Z',
        updated_at: '2026-06-01T18:30:00Z',
      },
    });
    mockUseTicketDetailViewModel.mockReturnValue({
      ticket: detail,
      status: 'ready',
      errorMessage: null,
      refresh: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('Used')).toBeDefined();
    expect(screen.queryByText(/show your qr on mobile/i)).toBeNull();
  });

  it('renders the not-found view when the ticket is missing or not owned by the caller', () => {
    mockUseTicketDetailViewModel.mockReturnValue({
      ticket: null,
      status: 'not-found',
      errorMessage: null,
      refresh: vi.fn(),
    });
    renderPage();
    // NotFoundView is rendered — no ticket-detail element
    expect(screen.queryByTestId('ticket-detail')).toBeNull();
  });

  it('renders an error message with retry when the request fails', () => {
    const refresh = vi.fn();
    mockUseTicketDetailViewModel.mockReturnValue({
      ticket: null,
      status: 'error',
      errorMessage: 'Network down',
      refresh,
    });
    renderPage();
    expect(screen.getByText('Network down')).toBeDefined();
    screen.getByRole('button', { name: /retry/i }).click();
    expect(refresh).toHaveBeenCalled();
  });
});
