export type NotificationType =
  | 'PRIVATE_EVENT_INVITATION_RECEIVED'
  | 'PRIVATE_EVENT_INVITATION_ACCEPTED'
  | 'PRIVATE_EVENT_INVITATION_DECLINED'
  | 'PROTECTED_EVENT_JOIN_REQUEST_APPROVED'
  | 'PROTECTED_EVENT_JOIN_REQUEST_REJECTED'
  | 'PROTECTED_EVENT_JOIN_REQUEST_SUBMITTED'
  | 'EVENT_CANCELED';

export interface NotificationItem {
  id: string;
  event_id: string | null;
  title: string;
  body: string;
  type: NotificationType | string | null;
  deep_link: string | null;
  image_url: string | null;
  data: Record<string, string>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPageInfo {
  next_cursor: string | null;
  has_next: boolean;
}

export interface ListNotificationsResponse {
  items: NotificationItem[];
  page_info: NotificationPageInfo;
}

export interface UnreadNotificationCountResponse {
  unread_count: number;
}

export interface MarkAllNotificationsReadResponse {
  updated_count: number;
}
