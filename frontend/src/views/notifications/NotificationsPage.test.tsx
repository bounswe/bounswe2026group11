// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { NotificationItem } from '@/models/notification';
import type { ReceivedInvitation } from '@/models/invitation';
import NotificationsPage from './NotificationsPage';

const mockUseNotificationsViewModel = vi.fn();
const mockGetMyInvitation = vi.fn();
const mockAcceptInvitation = vi.fn();
const mockDeclineInvitation = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'access-token' }),
}));

vi.mock('@/viewmodels/notifications/useNotificationsViewModel', () => ({
  useNotificationsViewModel: (...args: unknown[]) => mockUseNotificationsViewModel(...args),
}));

vi.mock('@/services/invitationService', () => ({
  getMyInvitation: (...args: unknown[]) => mockGetMyInvitation(...args),
  acceptInvitation: (...args: unknown[]) => mockAcceptInvitation(...args),
  declineInvitation: (...args: unknown[]) => mockDeclineInvitation(...args),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'notif-1',
    event_id: 'event-1',
    title: 'Private event invitation',
    body: 'You were invited.',
    type: 'PRIVATE_EVENT_INVITATION_RECEIVED',
    deep_link: '/events/event-1',
    image_url: null,
    data: {
      invitation_id: 'inv-1',
      event_title: 'Sunset Walk',
      actor_username: 'hostuser',
    },
    is_read: false,
    read_at: null,
    created_at: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

function makeInvitation(overrides: Partial<ReceivedInvitation> = {}): ReceivedInvitation {
  return {
    invitation_id: 'inv-1',
    status: 'PENDING',
    message: 'Hope you can make it!',
    expires_at: null,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
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

function renderPage(notification = makeNotification()) {
  mockUseNotificationsViewModel.mockReturnValue({
    notifications: [notification],
    isLoading: false,
    isLoadingMore: false,
    hasNext: false,
    error: null,
    fetchNotifications: vi.fn(),
    loadMore: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    deleteOne: vi.fn(),
    deleteAll: vi.fn(),
    dismissError: vi.fn(),
  });

  return render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>,
  );
}

describe('NotificationsPage invitation modal', () => {
  it('renders accepted and declined invitation notification labels in the feed', () => {
    mockUseNotificationsViewModel.mockReturnValue({
      notifications: [
        makeNotification({
          id: 'notif-accepted',
          type: 'PRIVATE_EVENT_INVITATION_ACCEPTED',
          data: { actor_username: 'guest', event_title: 'Sunset Walk' },
          is_read: true,
        }),
        makeNotification({
          id: 'notif-declined',
          type: 'PRIVATE_EVENT_INVITATION_DECLINED',
          data: { actor_username: 'guest', event_title: 'Sunset Walk' },
          is_read: true,
        }),
      ],
      isLoading: false,
      isLoadingMore: false,
      hasNext: false,
      error: null,
      fetchNotifications: vi.fn(),
      loadMore: vi.fn(),
      markRead: vi.fn(),
      markAllRead: vi.fn(),
      deleteOne: vi.fn(),
      deleteAll: vi.fn(),
      dismissError: vi.fn(),
    });

    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Accepted')).toBeDefined();
    expect(screen.getByText('Invitation accepted')).toBeDefined();
    expect(screen.getByText('Declined')).toBeDefined();
    expect(screen.getByText('Invitation declined')).toBeDefined();
  });

  it('opens invitation details from an invitation notification and fetches by invitation id', async () => {
    mockGetMyInvitation.mockResolvedValue(makeInvitation());
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /review invitation/i }));

    await waitFor(() => {
      expect(mockGetMyInvitation).toHaveBeenCalledWith('inv-1', 'access-token');
    });
    const dialog = await screen.findByRole('dialog', { name: /invitation details/i });
    expect(dialog).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Sunset Walk' })).toBeDefined();
    expect(screen.getByText(/hope you can make it/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /accept/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /decline/i })).toBeDefined();
  });

  it('shows a non-actionable canceled invitation state', async () => {
    mockGetMyInvitation.mockResolvedValue(makeInvitation({ status: 'CANCELED' }));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /review invitation/i }));

    expect(await screen.findByText(/host canceled this invitation/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: /^accept$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^decline$/i })).toBeNull();
  });
});
