/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import type {
  ListNotificationsResponse,
  NotificationItem,
} from '@/models/notification';
import * as notificationService from '@/services/notificationService';
import { useNotificationsViewModel } from './useNotificationsViewModel';

jest.mock('@/services/notificationService');
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-token',
    refreshToken: 'mock-refresh-token',
    setSession: jest.fn(),
    clearAuth: jest.fn(),
  }),
}));

const mockListNotifications = jest.mocked(notificationService.listNotifications);
const mockMarkNotificationRead = jest.mocked(notificationService.markNotificationRead);
const mockMarkAllNotificationsRead = jest.mocked(
  notificationService.markAllNotificationsRead,
);
const mockDeleteNotification = jest.mocked(notificationService.deleteNotification);

function makeNotification(
  id: string,
  overrides: Partial<NotificationItem> = {},
): NotificationItem {
  return {
    id,
    event_id: 'event-1',
    title: `Notification ${id}`,
    body: 'Notification body',
    type: 'PROTECTED_EVENT_JOIN_REQUEST_APPROVED',
    deep_link: '/events/event-1',
    image_url: null,
    data: { event_id: 'event-1' },
    is_read: false,
    read_at: null,
    created_at: '2026-04-30T12:00:00Z',
    ...overrides,
  };
}

function makeResponse(
  items: NotificationItem[],
  nextCursor: string | null = null,
): ListNotificationsResponse {
  return {
    items,
    page_info: {
      next_cursor: nextCursor,
      has_next: nextCursor != null,
    },
  };
}

describe('useNotificationsViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListNotifications.mockResolvedValue(makeResponse([makeNotification('n1')]));
    mockMarkNotificationRead.mockResolvedValue(undefined);
    mockMarkAllNotificationsRead.mockResolvedValue({ updated_count: 1 });
    mockDeleteNotification.mockResolvedValue(undefined);
  });

  it('loads notifications on mount', async () => {
    const { result } = renderHook(() => useNotificationsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockListNotifications).toHaveBeenCalledWith('mock-token', {
      limit: 25,
      cursor: null,
    });
    expect(result.current.notifications.map((item) => item.id)).toEqual(['n1']);
    expect(result.current.unreadCount).toBe(1);
  });

  it('loads more notifications with the next cursor', async () => {
    mockListNotifications
      .mockResolvedValueOnce(makeResponse([makeNotification('n1')], 'cursor-2'))
      .mockResolvedValueOnce(makeResponse([makeNotification('n2')]));

    const { result } = renderHook(() => useNotificationsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockListNotifications).toHaveBeenLastCalledWith('mock-token', {
      limit: 25,
      cursor: 'cursor-2',
    });
    expect(result.current.notifications.map((item) => item.id)).toEqual([
      'n1',
      'n2',
    ]);
  });

  it('marks a notification read optimistically', async () => {
    const { result } = renderHook(() => useNotificationsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.markRead('n1');
    });

    expect(mockMarkNotificationRead).toHaveBeenCalledWith('n1', 'mock-token');
    expect(result.current.notifications[0].is_read).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it('marks all notifications read', async () => {
    const { result } = renderHook(() => useNotificationsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(mockMarkAllNotificationsRead).toHaveBeenCalledWith('mock-token');
    expect(result.current.unreadCount).toBe(0);
  });

  it('removes a notification after delete succeeds', async () => {
    const { result } = renderHook(() => useNotificationsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.removeNotification('n1');
    });

    expect(mockDeleteNotification).toHaveBeenCalledWith('n1', 'mock-token');
    expect(result.current.notifications).toEqual([]);
  });
});
