// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReceivedInvitation } from '@/models/invitation';
import InvitationsPage from './InvitationsPage';

const mockUseInvitationsViewModel = vi.fn();

vi.mock('@/viewmodels/invitations/useInvitationsViewModel', () => ({
  useInvitationsViewModel: (...args: unknown[]) => mockUseInvitationsViewModel(...args),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeInvitation(overrides: Partial<ReceivedInvitation> = {}): ReceivedInvitation {
  return {
    invitation_id: 'inv-1',
    status: 'PENDING',
    message: 'Hope you can make it!',
    expires_at: null,
    created_at: '2026-04-10T10:00:00Z',
    updated_at: '2026-04-10T10:00:00Z',
    event: {
      id: 'event-1',
      title: 'Sunset Walk',
      image_url: null,
      start_time: '2026-05-01T18:00:00Z',
      end_time: null,
      status: 'ACTIVE',
      privacy_level: 'PRIVATE',
      approved_participant_count: 5,
    },
    host: {
      id: 'host-1',
      username: 'hostuser',
      display_name: 'Host User',
      avatar_url: null,
    },
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <InvitationsPage />
    </MemoryRouter>,
  );
}

describe('InvitationsPage', () => {
  it('shows loading state while fetching', () => {
    mockUseInvitationsViewModel.mockReturnValue({
      invitations: [],
      isLoading: true,
      isActionLoading: null,
      error: null,
      fetchInvitations: vi.fn(),
      handleAccept: vi.fn(),
      handleDecline: vi.fn(),
      dismissError: vi.fn(),
    });
    renderPage();
    expect(screen.getByText(/loading invitations/i)).toBeDefined();
  });

  it('shows empty state when there are no invitations', () => {
    mockUseInvitationsViewModel.mockReturnValue({
      invitations: [],
      isLoading: false,
      isActionLoading: null,
      error: null,
      fetchInvitations: vi.fn(),
      handleAccept: vi.fn(),
      handleDecline: vi.fn(),
      dismissError: vi.fn(),
    });
    renderPage();
    expect(screen.getByText(/no invitations yet/i)).toBeDefined();
  });

  it('renders pending invitation with accept and decline actions', () => {
    const invitation = makeInvitation();
    mockUseInvitationsViewModel.mockReturnValue({
      invitations: [invitation],
      isLoading: false,
      isActionLoading: null,
      error: null,
      fetchInvitations: vi.fn(),
      handleAccept: vi.fn(),
      handleDecline: vi.fn(),
      dismissError: vi.fn(),
    });
    renderPage();

    expect(screen.getByText('Sunset Walk')).toBeDefined();
    expect(screen.getByText(/Host User/)).toBeDefined();
    expect(screen.getByText(/hope you can make it/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /accept/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /decline/i })).toBeDefined();
  });

  it('renders past accepted invitation without response actions', () => {
    const invitation = makeInvitation({
      status: 'ACCEPTED',
      invitation_id: 'accepted-1',
      event: {
        ...makeInvitation().event,
        title: 'Accepted Private Event',
      },
    });
    mockUseInvitationsViewModel.mockReturnValue({
      invitations: [invitation],
      isLoading: false,
      isActionLoading: null,
      error: null,
      fetchInvitations: vi.fn(),
      handleAccept: vi.fn(),
      handleDecline: vi.fn(),
      dismissError: vi.fn(),
    });
    renderPage();

    expect(screen.getByText('Accepted Private Event')).toBeDefined();
    expect(screen.getByText('Accepted')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^accept$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^decline$/i })).toBeNull();
    expect(screen.getByRole('button', { name: /view event/i })).toBeDefined();
  });

  it('calls handleAccept when Accept is clicked', () => {
    const handleAccept = vi.fn().mockResolvedValue({ event_id: 'event-1' });
    const invitation = makeInvitation();
    mockUseInvitationsViewModel.mockReturnValue({
      invitations: [invitation],
      isLoading: false,
      isActionLoading: null,
      error: null,
      fetchInvitations: vi.fn(),
      handleAccept,
      handleDecline: vi.fn(),
      dismissError: vi.fn(),
    });
    renderPage();

    fireEvent.click(screen.getByTestId('accept-inv-1'));
    expect(handleAccept).toHaveBeenCalledWith('inv-1');
  });

  it('renders an error message and dismiss button', () => {
    const dismissError = vi.fn();
    mockUseInvitationsViewModel.mockReturnValue({
      invitations: [],
      isLoading: false,
      isActionLoading: null,
      error: 'Failed to load invitations',
      fetchInvitations: vi.fn(),
      handleAccept: vi.fn(),
      handleDecline: vi.fn(),
      dismissError,
    });
    renderPage();

    expect(screen.getByText(/failed to load invitations/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /dismiss error/i }));
    expect(dismissError).toHaveBeenCalled();
  });
});
