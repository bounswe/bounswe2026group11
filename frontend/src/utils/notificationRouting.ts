import type { NotificationItem } from '@/models/notification';
import {
  getNotificationPresentation,
  type NotificationActionTarget,
} from './notificationPresentation';

const UUIDISH_SEGMENT = '[0-9a-fA-F-]{20,}';

function normalizeRoute(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const eventRouteMatch = trimmed.match(
    new RegExp(`(?:^|://|/)(?:events|event)/(${UUIDISH_SEGMENT})(?:$|[/?#])`),
  );
  if (eventRouteMatch?.[1]) return `/events/${eventRouteMatch[1]}`;

  const invitationsMatch = trimmed.match(
    /(?:^|:\/\/|\/)invitations(?:$|[/?#])/,
  );
  if (invitationsMatch) return '/invitations';

  const notificationsMatch = trimmed.match(
    /(?:^|:\/\/|\/)notifications(?:$|[/?#])/,
  );
  if (notificationsMatch) return '/notifications';

  return null;
}

/**
 * Resolve the in-app route a notification should navigate to when clicked.
 * Returns null when the notification has no actionable target.
 */
export function resolveNotificationRoute(
  notification: NotificationItem,
): string | null {
  // Notification-type-specific routing always wins so participation flows go
  // to the right surface (e.g. invitations index for newly received invites).
  const presentation = getNotificationPresentation(notification);
  const target: NotificationActionTarget = presentation.actionTarget;

  if (target === 'INVITATIONS') return '/invitations';

  if (target === 'EVENT') {
    const eventId = notification.event_id ?? notification.data?.event_id ?? null;
    if (eventId) return `/events/${eventId}`;
  }

  // Fall back to the deep link if backend supplied one we can interpret.
  if (notification.deep_link) {
    const explicit = normalizeRoute(notification.deep_link);
    if (explicit) return explicit;
  }

  // Last resort: any notification with an event_id can show that event.
  const fallbackEventId = notification.event_id ?? notification.data?.event_id ?? null;
  if (fallbackEventId) return `/events/${fallbackEventId}`;

  return null;
}
