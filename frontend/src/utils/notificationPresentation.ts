import type { NotificationItem, NotificationType } from '@/models/notification';

export type NotificationActionTarget = 'EVENT' | 'INVITATIONS' | 'NONE';

export interface NotificationPresentation {
  accentColor: string;
  accentBackgroundColor: string;
  badgeLabel: string | null;
  title: string | null;
  eventTitle: string | null;
  iconKind: 'mail' | 'check' | 'cross' | 'bell';
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
  'EVENT_CANCELED',
  'PRIVATE_EVENT_INVITATION_ACCEPTED',
  'PRIVATE_EVENT_INVITATION_DECLINED',
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
  return `Retry after ${timestamp.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;
}

export function isDedicatedParticipationNotification(
  type: string | null | undefined,
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
  const actorLabel = formatActorLabel(notification.data);

  switch (notification.type) {
    case 'PRIVATE_EVENT_INVITATION_RECEIVED':
      return {
        accentColor: '#5B21B6',
        accentBackgroundColor: '#EDE9FE',
        badgeLabel: 'Invitation',
        title: 'Private event invitation',
        eventTitle,
        iconKind: 'mail',
        summary: actorLabel
          ? `${actorLabel} invited you to a private event.`
          : 'You received a private event invitation.',
        metadata: [],
        actionLabel: 'Review invitation',
        actionTarget: 'INVITATIONS',
      };
    case 'PROTECTED_EVENT_JOIN_REQUEST_APPROVED':
      return {
        accentColor: '#047857',
        accentBackgroundColor: '#DCFCE7',
        badgeLabel: 'Approved',
        title: 'Join request approved',
        eventTitle,
        iconKind: 'check',
        summary: actorLabel
          ? `${actorLabel} approved your join request.`
          : 'Your join request was approved.',
        metadata: [],
        actionLabel: 'Open event',
        actionTarget: 'EVENT',
      };
    case 'PROTECTED_EVENT_JOIN_REQUEST_REJECTED': {
      const cooldown = formatCooldown(notification.data.cooldown_ends_at);
      return {
        accentColor: '#B45309',
        accentBackgroundColor: '#FEF3C7',
        badgeLabel: 'Rejected',
        title: 'Join request rejected',
        eventTitle,
        iconKind: 'cross',
        summary: actorLabel
          ? `${actorLabel} rejected your join request.`
          : 'Your join request was rejected.',
        metadata: cooldown ? [cooldown] : [],
        actionLabel: 'View event details',
        actionTarget: 'EVENT',
      };
    }
    case 'PROTECTED_EVENT_JOIN_REQUEST_SUBMITTED':
      return {
        accentColor: '#D97706',
        accentBackgroundColor: '#FEF3C7',
        badgeLabel: 'New Request',
        title: 'Join request submitted',
        eventTitle,
        iconKind: 'mail',
        summary: actorLabel
          ? `${actorLabel} wants to join your event.`
          : 'Someone wants to join your event.',
        metadata: [],
        actionLabel: 'Review request',
        actionTarget: 'EVENT',
      };
    case 'EVENT_CANCELED':
      return {
        accentColor: '#B91C1C',
        accentBackgroundColor: '#FEE2E2',
        badgeLabel: 'Canceled',
        title: 'Event canceled',
        eventTitle,
        iconKind: 'cross',
        summary: eventTitle
          ? `The event "${eventTitle}" has been canceled.`
          : 'An event you were interested in has been canceled.',
        metadata: [],
        actionLabel: 'View event',
        actionTarget: 'EVENT',
      };
    case 'PRIVATE_EVENT_INVITATION_ACCEPTED':
      return {
        accentColor: '#047857',
        accentBackgroundColor: '#DCFCE7',
        badgeLabel: 'Accepted',
        title: 'Invitation accepted',
        eventTitle,
        iconKind: 'check',
        summary: actorLabel
          ? `${actorLabel} accepted your invitation.`
          : 'Your invitation was accepted.',
        metadata: [],
        actionLabel: 'View event',
        actionTarget: 'EVENT',
      };
    case 'PRIVATE_EVENT_INVITATION_DECLINED':
      return {
        accentColor: '#B45309',
        accentBackgroundColor: '#FEF3C7',
        badgeLabel: 'Declined',
        title: 'Invitation declined',
        eventTitle,
        iconKind: 'cross',
        summary: actorLabel
          ? `${actorLabel} declined your invitation.`
          : 'Your invitation was declined.',
        metadata: [],
        actionLabel: 'View event',
        actionTarget: 'EVENT',
      };
    default:
      return {
        accentColor: '#0F172A',
        accentBackgroundColor: '#E2E8F0',
        badgeLabel: null,
        title: notification.title,
        eventTitle,
        iconKind: 'bell',
        summary: notification.body,
        metadata: [],
        actionLabel: notification.event_id ? 'View event' : null,
        actionTarget: notification.event_id ? 'EVENT' : 'NONE',
      };
  }
}
