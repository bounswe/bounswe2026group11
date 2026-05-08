// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { TicketListItem } from '@/models/ticket';
import TicketsPage from './TicketsPage';

const mockUseTicketsViewModel = vi.fn();

vi.mock('@/viewmodels/tickets/useTicketsViewModel', () => ({
  useTicketsViewModel: (...args: unknown[]) => mockUseTicketsViewModel(...args),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeTicket(overrides: Partial<TicketListItem> = {}): TicketListItem {
  return {
    ticket_id: 'ticket-1',
    status: 'ACTIVE',
    expires_at: '2026-06-01T20:00:00Z',
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
    participation: {
      id: 'participation-1',
      status: 'APPROVED',
    },
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TicketsPage />
    </MemoryRouter>,
  );
}

describe('TicketsPage', () => {
  it('shows the loading state while fetching', () => {
    mockUseTicketsViewModel.mockReturnValue({
      tickets: [],
      isLoading: true,
      error: null,
      refresh: vi.fn(),
      dismissError: vi.fn(),
    });
    renderPage();
    expect(screen.getByText(/loading tickets/i)).toBeDefined();
  });

  it('renders the empty state when there are no tickets', () => {
    mockUseTicketsViewModel.mockReturnValue({
      tickets: [],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
      dismissError: vi.fn(),
    });
    renderPage();
    expect(screen.getByText(/no tickets yet/i)).toBeDefined();
    expect(
      screen.getByText(/tickets appear here once a host approves/i),
    ).toBeDefined();
  });

  it('renders an active ticket card with status badge and event info', () => {
    const ticket = makeTicket();
    mockUseTicketsViewModel.mockReturnValue({
      tickets: [ticket],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
      dismissError: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('Sunset Walk')).toBeDefined();
    expect(screen.getByText('Active')).toBeDefined();
    expect(screen.getByText('Moda Coast')).toBeDefined();
    expect(screen.getByTestId('ticket-ticket-1')).toBeDefined();
  });

  it('renders a USED ticket with the Used status badge', () => {
    const ticket = makeTicket({ ticket_id: 'ticket-used', status: 'USED' });
    mockUseTicketsViewModel.mockReturnValue({
      tickets: [ticket],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
      dismissError: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('Used')).toBeDefined();
  });

  it('renders an error message that can be dismissed', () => {
    const dismissError = vi.fn();
    mockUseTicketsViewModel.mockReturnValue({
      tickets: [],
      isLoading: false,
      error: 'Failed to load tickets',
      refresh: vi.fn(),
      dismissError,
    });
    renderPage();
    expect(screen.getByText(/failed to load tickets/i)).toBeDefined();
    screen.getByRole('button', { name: /dismiss error/i }).click();
    expect(dismissError).toHaveBeenCalled();
  });
});
