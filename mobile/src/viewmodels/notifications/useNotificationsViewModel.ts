import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { NotificationItem } from '@/models/notification';
import { ApiError } from '@/services/api';
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notificationService';

const NOTIFICATION_PAGE_SIZE = 25;

export interface NotificationsViewModel {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  apiError: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  removeNotification: (notificationId: string) => Promise<void>;
}

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'You must be logged in to view notifications.';
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  return 'Failed to load notifications. Please try again.';
}

function getMutationErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'You must be logged in to manage notifications.';
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  return 'Failed to update notifications. Please try again.';
}

function mergeNotifications(
  current: NotificationItem[],
  incoming: NotificationItem[],
): NotificationItem[] {
  const seen = new Set(current.map((item) => item.id));
  const merged = [...current];

  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }

  return merged;
}

function countUnread(notifications: NotificationItem[]): number {
  return notifications.filter((notification) => !notification.is_read).length;
}

export function useNotificationsViewModel(): NotificationsViewModel {
  const { token } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchNotifications = useCallback(
    async (
      mode: 'initial' | 'refresh' | 'more',
      cursor: string | null = null,
    ) => {
      if (!token) {
        setNotifications([]);
        setNextCursor(null);
        setHasMore(false);
        setApiError('You must be logged in to view notifications.');
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
        return;
      }

      if (mode === 'initial') setIsLoading(true);
      if (mode === 'refresh') setIsRefreshing(true);
      if (mode === 'more') setIsLoadingMore(true);

      setApiError(null);

      try {
        const response = await listNotifications(token, {
          limit: NOTIFICATION_PAGE_SIZE,
          cursor: mode === 'more' ? cursor : null,
        });

        setNotifications((current) =>
          mode === 'more'
            ? mergeNotifications(current, response.items)
            : response.items,
        );
        setNextCursor(response.page_info.next_cursor);
        setHasMore(response.page_info.has_next);
      } catch (error) {
        if (mode === 'initial') {
          setNotifications([]);
        }

        setApiError(getLoadErrorMessage(error));
      } finally {
        if (mode === 'initial') setIsLoading(false);
        if (mode === 'refresh') setIsRefreshing(false);
        if (mode === 'more') setIsLoadingMore(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void fetchNotifications('initial');
  }, [fetchNotifications]);

  const refresh = useCallback(async () => {
    await fetchNotifications('refresh');
  }, [fetchNotifications]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !nextCursor) return;
    await fetchNotifications('more', nextCursor);
  }, [fetchNotifications, hasMore, isLoadingMore, nextCursor]);

  const markRead = useCallback(
    async (notificationId: string) => {
      if (!token) return;

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                is_read: true,
                read_at: notification.read_at ?? new Date().toISOString(),
              }
            : notification,
        ),
      );

      try {
        await markNotificationRead(notificationId, token);
      } catch (error) {
        setApiError(getMutationErrorMessage(error));
      }
    },
    [token],
  );

  const markAllRead = useCallback(async () => {
    if (!token) return;

    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        is_read: true,
        read_at: notification.read_at ?? readAt,
      })),
    );

    try {
      await markAllNotificationsRead(token);
    } catch (error) {
      setApiError(getMutationErrorMessage(error));
    }
  }, [token]);

  const removeNotification = useCallback(
    async (notificationId: string) => {
      if (!token) return;

      const previous = notifications;
      setNotifications((current) =>
        current.filter((notification) => notification.id !== notificationId),
      );

      try {
        await deleteNotification(notificationId, token);
      } catch (error) {
        setNotifications(previous);
        setApiError(getMutationErrorMessage(error));
      }
    },
    [notifications, token],
  );

  return {
    notifications,
    unreadCount: countUnread(notifications),
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    apiError,
    refresh,
    loadMore,
    markRead,
    markAllRead,
    removeNotification,
  };
}
