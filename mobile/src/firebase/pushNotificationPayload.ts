export interface PushRemoteMessageLike {
  messageId?: string;
  notification?: {
    title?: string;
    body?: string;
  };
  data?: Record<string, unknown>;
}

export interface NormalizedPushNotificationPayload {
  title: string;
  body: string | null;
  notification_id: string | null;
  event_id: string | null;
  deep_link: string | null;
  data: Record<string, string>;
}

function toStringData(data?: Record<string, unknown>): Record<string, string> {
  if (!data) return {};

  return Object.entries(data).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value == null) return acc;
    acc[key] = String(value);
    return acc;
  }, {});
}

function firstString(...values: Array<string | undefined>): string | null {
  const value = values.find((candidate) => candidate?.trim());
  return value ? value.trim() : null;
}

export function normalizePushNotificationPayload(
  remoteMessage: PushRemoteMessageLike,
): NormalizedPushNotificationPayload {
  const data = toStringData(remoteMessage.data);

  return {
    title: firstString(remoteMessage.notification?.title, data.title) ?? 'Notification',
    body: firstString(remoteMessage.notification?.body, data.body),
    notification_id: firstString(
      data.notification_id,
      data.notificationId,
      remoteMessage.messageId,
    ),
    event_id: firstString(data.event_id, data.eventId),
    deep_link: firstString(data.deep_link, data.deepLink),
    data,
  };
}
