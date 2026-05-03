import {
  ListNotificationsResponse,
  MarkAllNotificationsReadResponse,
  UnreadNotificationCountResponse,
} from '@/models/notification';
import { apiDeleteAuth, apiGetAuth, apiPatchAuth } from '@/services/api';

export interface ListNotificationsParams {
  limit?: number;
  cursor?: string | null;
  onlyUnread?: boolean;
}

function notificationListEndpoint(params?: ListNotificationsParams): string {
  const query = new URLSearchParams();

  if (params?.limit) {
    query.set('limit', String(params.limit));
  }

  if (params?.cursor) {
    query.set('cursor', params.cursor);
  }

  const path = params?.onlyUnread
    ? '/me/notifications/unread'
    : '/me/notifications';
  const serialized = query.toString();

  return serialized ? `${path}?${serialized}` : path;
}

export function listNotifications(
  token: string,
  params?: ListNotificationsParams,
): Promise<ListNotificationsResponse> {
  return apiGetAuth<ListNotificationsResponse>(
    notificationListEndpoint(params),
    token,
  );
}

export function getUnreadNotificationCount(
  token: string,
): Promise<UnreadNotificationCountResponse> {
  return apiGetAuth<UnreadNotificationCountResponse>(
    '/me/notifications/unread-count',
    token,
  );
}

export function markNotificationRead(
  notificationId: string,
  token: string,
): Promise<void> {
  return apiPatchAuth<void>(
    `/me/notifications/${notificationId}/read`,
    {},
    token,
  );
}

export function markAllNotificationsRead(
  token: string,
): Promise<MarkAllNotificationsReadResponse> {
  return apiPatchAuth<MarkAllNotificationsReadResponse>(
    '/me/notifications/read',
    {},
    token,
  );
}

export function deleteNotification(
  notificationId: string,
  token: string,
): Promise<void> {
  return apiDeleteAuth<void>(`/me/notifications/${notificationId}`, token);
}

export function deleteAllNotifications(token: string): Promise<void> {
  return apiDeleteAuth<void>('/me/notifications', token);
}
