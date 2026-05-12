import type { NotificationItem, NotificationType } from '@/models/notification';
import i18n from '@/i18n';

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
  return i18n.t('notifications.presentation.cooldown', { date: timestamp.toLocaleDateString(i18n.resolvedLanguage, {
    month: 'short',
    day: 'numeric',
  }) });
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
    notification.event_id ? i18n.t('notifications.presentation.event_update') : null,
  );
  const actorLabel = formatActorLabel(notification.data);

  switch (notification.type) {
    case 'PRIVATE_EVENT_INVITATION_RECEIVED':
      return {
        accentColor: '#5B21B6',
        accentBackgroundColor: '#EDE9FE',
        badgeLabel: i18n.t('notifications.presentation.badge_invitation'),
        title: i18n.t('notifications.presentation.title_private_invitation'),
        eventTitle,
        iconKind: 'mail',
        summary: actorLabel
          ? i18n.t('notifications.presentation.summary_private_invitation_actor', { actor: actorLabel })
          : i18n.t('notifications.presentation.summary_private_invitation_default'),
        metadata: [],
        actionLabel: i18n.t('notifications.presentation.action_review_invitation'),
        actionTarget: 'INVITATIONS',
      };
    case 'PROTECTED_EVENT_JOIN_REQUEST_APPROVED':
      return {
        accentColor: '#047857',
        accentBackgroundColor: '#DCFCE7',
        badgeLabel: i18n.t('notifications.presentation.badge_approved'),
        title: i18n.t('notifications.presentation.title_join_approved'),
        eventTitle,
        iconKind: 'check',
        summary: actorLabel
          ? i18n.t('notifications.presentation.summary_join_approved_actor', { actor: actorLabel })
          : i18n.t('notifications.presentation.summary_join_approved_default'),
        metadata: [],
        actionLabel: i18n.t('notifications.presentation.action_open_event'),
        actionTarget: 'EVENT',
      };
    case 'PROTECTED_EVENT_JOIN_REQUEST_REJECTED': {
      const cooldown = formatCooldown(notification.data.cooldown_ends_at);
      return {
        accentColor: '#B45309',
        accentBackgroundColor: '#FEF3C7',
        badgeLabel: i18n.t('notifications.presentation.badge_rejected'),
        title: i18n.t('notifications.presentation.title_join_rejected'),
        eventTitle,
        iconKind: 'cross',
        summary: actorLabel
          ? i18n.t('notifications.presentation.summary_join_rejected_actor', { actor: actorLabel })
          : i18n.t('notifications.presentation.summary_join_rejected_default'),
        metadata: cooldown ? [cooldown] : [],
        actionLabel: i18n.t('notifications.presentation.action_view_event_details'),
        actionTarget: 'EVENT',
      };
    }
    case 'PROTECTED_EVENT_JOIN_REQUEST_SUBMITTED':
      return {
        accentColor: '#D97706',
        accentBackgroundColor: '#FEF3C7',
        badgeLabel: i18n.t('notifications.presentation.badge_new_request'),
        title: i18n.t('notifications.presentation.title_join_submitted'),
        eventTitle,
        iconKind: 'mail',
        summary: actorLabel
          ? i18n.t('notifications.presentation.summary_join_submitted_actor', { actor: actorLabel })
          : i18n.t('notifications.presentation.summary_join_submitted_default'),
        metadata: [],
        actionLabel: i18n.t('notifications.presentation.action_review_request'),
        actionTarget: 'EVENT',
      };
    case 'EVENT_CANCELED':
      return {
        accentColor: '#B91C1C',
        accentBackgroundColor: '#FEE2E2',
        badgeLabel: i18n.t('notifications.presentation.badge_canceled'),
        title: i18n.t('notifications.presentation.title_event_canceled'),
        eventTitle,
        iconKind: 'cross',
        summary: eventTitle
          ? i18n.t('notifications.presentation.summary_event_canceled_with_title', { title: eventTitle })
          : i18n.t('notifications.presentation.summary_event_canceled_default'),
        metadata: [],
        actionLabel: i18n.t('notifications.presentation.action_view_event'),
        actionTarget: 'EVENT',
      };
    case 'PRIVATE_EVENT_INVITATION_ACCEPTED':
      return {
        accentColor: '#047857',
        accentBackgroundColor: '#DCFCE7',
        badgeLabel: i18n.t('notifications.presentation.badge_accepted'),
        title: i18n.t('notifications.presentation.title_invitation_accepted'),
        eventTitle,
        iconKind: 'check',
        summary: actorLabel
          ? i18n.t('notifications.presentation.summary_invitation_accepted_actor', { actor: actorLabel })
          : i18n.t('notifications.presentation.summary_invitation_accepted_default'),
        metadata: [],
        actionLabel: i18n.t('notifications.presentation.action_view_event'),
        actionTarget: 'EVENT',
      };
    case 'PRIVATE_EVENT_INVITATION_DECLINED':
      return {
        accentColor: '#B45309',
        accentBackgroundColor: '#FEF3C7',
        badgeLabel: i18n.t('notifications.presentation.badge_declined'),
        title: i18n.t('notifications.presentation.title_invitation_declined'),
        eventTitle,
        iconKind: 'cross',
        summary: actorLabel
          ? i18n.t('notifications.presentation.summary_invitation_declined_actor', { actor: actorLabel })
          : i18n.t('notifications.presentation.summary_invitation_declined_default'),
        metadata: [],
        actionLabel: i18n.t('notifications.presentation.action_view_event'),
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
        actionLabel: notification.event_id ? i18n.t('notifications.presentation.action_view_event') : null,
        actionTarget: notification.event_id ? 'EVENT' : 'NONE',
      };
  }
}
