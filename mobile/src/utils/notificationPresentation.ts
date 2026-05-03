import type { NotificationItem, NotificationType } from '@/models/notification';
import { formatEventDateLabel } from '@/utils/eventDate';

export type NotificationActionTarget = 'EVENT' | 'INVITATIONS' | 'NONE';

export interface NotificationPresentation {
  accentColor: string;
  accentBackgroundColor: string;
  badgeLabel: string | null;
  eventTitle: string | null;
  iconName:
    | 'mail-open-outline'
    | 'checkmark-circle-outline'
    | 'close-circle-outline'
    | 'notifications-outline';
  summary: string;
  metadata: string[];
  actionLabel: string | null;
  actionTarget: NotificationActionTarget;
}

const PARTICIPATION_NOTIFICATION_TYPES: NotificationType[] = [
  'PRIVATE_EVENT_INVITATION_RECEIVED',
  'PROTECTED_EVENT_JOIN_REQUEST_APPROVED',
  'PROTECTED_EVENT_JOIN_REQUEST_REJECTED',
  'PROTECTED_EVENT_JOIN_REQUEST_SUBMITTED',
];

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function formatActorLabel(data: Record<string, string>): string | null {
  return firstNonEmpty(data.actor_display_name, data.actor_username);
}

function formatCooldown(iso: string | undefined): string | null {
  if (!iso) return null;
  const timestamp = new Date(iso);
  if (Number.isNaN(timestamp.getTime())) return null;
  return `Retry after ${timestamp.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  })}`;
}

function formatEventTime(data: Record<string, string>): string | null {
  const startTime = data.event_start_time;
  if (!startTime) return null;
  return formatEventDateLabel(startTime);
}

function buildFallbackPresentation(
  notification: NotificationItem,
): NotificationPresentation {
  const eventTitle = firstNonEmpty(notification.data.event_title);
  const eventTime = formatEventTime(notification.data);
  const metadata = [eventTitle, eventTime].filter(
    (value): value is string => Boolean(value),
  );

  return {
    accentColor: '#0F172A',
    accentBackgroundColor: '#E2E8F0',
    badgeLabel: null,
    eventTitle,
    iconName: 'notifications-outline',
    summary: notification.body,
    metadata,
    actionLabel: notification.event_id || notification.data.event_id ? 'View event' : null,
    actionTarget:
      notification.event_id || notification.data.event_id ? 'EVENT' : 'NONE',
  };
}

export function isDedicatedParticipationNotification(
  type: string | null,
): type is NotificationType {
  return PARTICIPATION_NOTIFICATION_TYPES.includes(type as NotificationType);
}

export function getNotificationPresentation(
  notification: NotificationItem,
): NotificationPresentation {
  const eventTitle = firstNonEmpty(
    notification.data.event_title,
    notification.event_id ? 'Event update' : null,
  );
  const eventTime = formatEventTime(notification.data);
  const actorLabel = formatActorLabel(notification.data);

  switch (notification.type) {
    case 'PRIVATE_EVENT_INVITATION_RECEIVED':
      return {
        accentColor: '#5B21B6',
        accentBackgroundColor: '#EDE9FE',
        badgeLabel: 'Invitation',
        eventTitle,
        iconName: 'mail-open-outline',
        summary: actorLabel
          ? `${actorLabel} invited you to a private event.`
          : 'You received a private event invitation.',
        metadata: [eventTitle, eventTime, 'Open invitation flow'].filter(
          (value): value is string => Boolean(value),
        ),
        actionLabel: 'Review invitation',
        actionTarget: 'INVITATIONS',
      };
    case 'PROTECTED_EVENT_JOIN_REQUEST_APPROVED':
      return {
        accentColor: '#047857',
        accentBackgroundColor: '#DCFCE7',
        badgeLabel: 'Approved',
        eventTitle,
        iconName: 'checkmark-circle-outline',
        summary: actorLabel
          ? `${actorLabel} approved your join request.`
          : 'Your join request was approved.',
        metadata: [eventTitle, eventTime, 'You can open the event now'].filter(
          (value): value is string => Boolean(value),
        ),
        actionLabel: 'Open event',
        actionTarget: 'EVENT',
      };
    case 'PROTECTED_EVENT_JOIN_REQUEST_REJECTED': {
      const cooldown = formatCooldown(notification.data.cooldown_ends_at);
      return {
        accentColor: '#B45309',
        accentBackgroundColor: '#FEF3C7',
        badgeLabel: 'Rejected',
        eventTitle,
        iconName: 'close-circle-outline',
        summary: actorLabel
          ? `${actorLabel} rejected your join request.`
          : 'Your join request was rejected.',
        metadata: [eventTitle, eventTime, cooldown ?? 'Check the event for current details'].filter(
          (value): value is string => Boolean(value),
        ),
        actionLabel: 'View event details',
        actionTarget: 'EVENT',
      };
    }
    case 'PROTECTED_EVENT_JOIN_REQUEST_SUBMITTED':
      return {
        accentColor: '#D97706',
        accentBackgroundColor: '#FEF3C7',
        badgeLabel: 'New Request',
        eventTitle,
        iconName: 'mail-open-outline',
        summary: actorLabel
          ? `${actorLabel} wants to join your event.`
          : 'Someone wants to join your event.',
        metadata: [eventTitle, eventTime, 'Review this join request'].filter(
          (value): value is string => Boolean(value),
        ),
        actionLabel: 'Review request',
        actionTarget: 'EVENT',
      };
    default:
      return buildFallbackPresentation(notification);
  }
}
