export interface NotificationItem {
  id: string;
  event_id: string | null;
  title: string;
  body: string;
  type: string | null;
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
