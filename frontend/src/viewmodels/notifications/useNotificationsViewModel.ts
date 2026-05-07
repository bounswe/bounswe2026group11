import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  deleteAllNotifications,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notificationService';
import type { NotificationItem } from '@/models/notification';
import { ApiError } from '@/services/api';

export interface NotificationsViewModel {
  notifications: NotificationItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasNext: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteOne: (id: string) => Promise<void>;
  deleteAll: () => Promise<void>;
  dismissError: () => void;
}

const PAGE_SIZE = 20;

export function useNotificationsViewModel(): NotificationsViewModel {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await listNotifications(token, { limit: PAGE_SIZE });
      setNotifications(response.items ?? []);
      setNextCursor(response.page_info.next_cursor);
      setHasNext(response.page_info.has_next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const loadMore = useCallback(async () => {
    if (!token || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const response = await listNotifications(token, {
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });
      setNotifications((prev) => [...prev, ...(response.items ?? [])]);
      setNextCursor(response.page_info.next_cursor);
      setHasNext(response.page_info.has_next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load more notifications');
    } finally {
      setIsLoadingMore(false);
    }
  }, [token, nextCursor, isLoadingMore]);

  const markRead = useCallback(
    async (id: string) => {
      if (!token) return;
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id && !n.is_read
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n,
        ),
      );
      try {
        await markNotificationRead(id, token);
      } catch {
        // Roll back on failure
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: false, read_at: null } : n)),
        );
      }
    },
    [token],
  );

  const markAllRead = useCallback(async () => {
    if (!token) return;
    const previous = notifications;
    setNotifications((prev) =>
      prev.map((n) =>
        n.is_read ? n : { ...n, is_read: true, read_at: new Date().toISOString() },
      ),
    );
    try {
      await markAllNotificationsRead(token);
    } catch (err) {
      setNotifications(previous);
      setError(err instanceof ApiError ? err.message : 'Failed to mark all as read');
    }
  }, [token, notifications]);

  const deleteOne = useCallback(
    async (id: string) => {
      if (!token) return;
      const previous = notifications;
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      try {
        await deleteNotification(id, token);
      } catch (err) {
        setNotifications(previous);
        setError(err instanceof ApiError ? err.message : 'Failed to delete notification');
      }
    },
    [token, notifications],
  );

  const deleteAll = useCallback(async () => {
    if (!token) return;
    const previous = notifications;
    setNotifications([]);
    try {
      await deleteAllNotifications(token);
    } catch (err) {
      setNotifications(previous);
      setError(err instanceof ApiError ? err.message : 'Failed to clear notifications');
    }
  }, [token, notifications]);

  const dismissError = useCallback(() => setError(null), []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    isLoading,
    isLoadingMore,
    hasNext,
    error,
    fetchNotifications,
    loadMore,
    markRead,
    markAllRead,
    deleteOne,
    deleteAll,
    dismissError,
  };
}
