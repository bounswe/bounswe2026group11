import type { NotificationItem, NotificationType } from '@/models/notification';
import { formatEventDateLabel } from '@/utils/eventDate';
import i18n from '@/i18n';

export type NotificationActionTarget = 'EVENT' | 'INVITATIONS' | 'NONE';

export interface NotificationPresentation {
  accentColor: string;
  accentBackgroundColor: string;
  badgeLabel: string | null;
  title: string | null;
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
  return i18n.t('notifications.presentation.retryAfter', {
    date: timestamp.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    }),
  });
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
  const metadata: string[] = [];
  const rawTitle = notification.title.trim();
  const rawBody = notification.body.trim();
  const normalizedTitle = rawTitle.toLowerCase();
  const normalizedBody = rawBody.toLowerCase();

  const title = normalizedTitle === 'event details changed'
    ? i18n.t('notifications.presentation.titles.eventDetailsChanged')
    : notification.title;
  const summary = normalizedBody.includes('review the version history')
    ? i18n.t('notifications.presentation.summaries.eventDetailsChanged')
    : notification.body;
  const badgeLabel = normalizedTitle === 'event details changed'
    ? i18n.t('notifications.presentation.badges.updated')
    : null;
  const actionLabel = notification.event_id || notification.data.event_id
    ? normalizedTitle === 'event details changed'
      ? i18n.t('notifications.presentation.actions.reviewChanges')
      : i18n.t('notifications.presentation.actions.viewEvent')
    : null;

  return {
    accentColor: '#0F172A',
    accentBackgroundColor: '#E2E8F0',
    badgeLabel,
    title,
    eventTitle,
    iconName: 'notifications-outline',
    summary,
    metadata,
    actionLabel,
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
    notification.event_id ? i18n.t('notifications.presentation.eventUpdate') : null,
  );
  const eventTime = formatEventTime(notification.data);
  const actorLabel = formatActorLabel(notification.data);

  switch (notification.type) {
    case 'PRIVATE_EVENT_INVITATION_RECEIVED':
      return {
        accentColor: '#5B21B6',
        accentBackgroundColor: '#EDE9FE',
        badgeLabel: i18n.t('notifications.presentation.badges.invitation'),
        title: i18n.t('notifications.presentation.titles.privateInvitation'),
        eventTitle,
        iconName: 'mail-open-outline',
        summary: actorLabel
          ? i18n.t('notifications.presentation.summaries.privateInvitationFrom', { actor: actorLabel })
          : i18n.t('notifications.presentation.summaries.privateInvitation'),
        metadata: [],
        actionLabel: i18n.t('notifications.presentation.actions.reviewInvitation'),
        actionTarget: 'INVITATIONS',
      };
    case 'PROTECTED_EVENT_JOIN_REQUEST_APPROVED':
      return {
        accentColor: '#047857',
        accentBackgroundColor: '#DCFCE7',
        badgeLabel: i18n.t('notifications.presentation.badges.approved'),
        title: i18n.t('notifications.presentation.titles.joinApproved'),
        eventTitle,
        iconName: 'checkmark-circle-outline',
        summary: actorLabel
          ? i18n.t('notifications.presentation.summaries.joinApprovedBy', { actor: actorLabel })
          : i18n.t('notifications.presentation.summaries.joinApproved'),
        metadata: [],
        actionLabel: i18n.t('notifications.presentation.actions.openEvent'),
        actionTarget: 'EVENT',
      };
    case 'PROTECTED_EVENT_JOIN_REQUEST_REJECTED': {
      const cooldown = formatCooldown(notification.data.cooldown_ends_at);
      return {
        accentColor: '#B45309',
        accentBackgroundColor: '#FEF3C7',
        badgeLabel: i18n.t('notifications.presentation.badges.rejected'),
        title: i18n.t('notifications.presentation.titles.joinRejected'),
        eventTitle,
        iconName: 'close-circle-outline',
        summary: actorLabel
          ? i18n.t('notifications.presentation.summaries.joinRejectedBy', { actor: actorLabel })
          : i18n.t('notifications.presentation.summaries.joinRejected'),
        metadata: cooldown ? [cooldown] : ([] as string[]),
        actionLabel: i18n.t('notifications.presentation.actions.viewEventDetails'),
        actionTarget: 'EVENT',
      };
    }
    case 'PROTECTED_EVENT_JOIN_REQUEST_SUBMITTED':
      return {
        accentColor: '#D97706',
        accentBackgroundColor: '#FEF3C7',
        badgeLabel: i18n.t('notifications.presentation.badges.newRequest'),
        title: i18n.t('notifications.presentation.titles.joinSubmitted'),
        eventTitle,
        iconName: 'mail-open-outline',
        summary: actorLabel
          ? i18n.t('notifications.presentation.summaries.joinSubmittedBy', { actor: actorLabel })
          : i18n.t('notifications.presentation.summaries.joinSubmitted'),
        metadata: [],
        actionLabel: i18n.t('notifications.presentation.actions.reviewRequest'),
        actionTarget: 'EVENT',
      };
    case 'EVENT_CANCELED':
      return {
        accentColor: '#B91C1C',
        accentBackgroundColor: '#FEE2E2',
        badgeLabel: i18n.t('notifications.presentation.badges.canceled'),
        title: i18n.t('notifications.presentation.titles.eventCanceled'),
        eventTitle,
        iconName: 'close-circle-outline',
        summary: eventTitle
          ? i18n.t('notifications.presentation.summaries.eventCanceledNamed', { event: eventTitle })
          : i18n.t('notifications.presentation.summaries.eventCanceled'),
        metadata: [],
        actionLabel: i18n.t('notifications.presentation.actions.viewEvent'),
        actionTarget: 'EVENT',
      };
    case 'PRIVATE_EVENT_INVITATION_ACCEPTED':
      return {
        accentColor: '#047857',
        accentBackgroundColor: '#DCFCE7',
        badgeLabel: i18n.t('notifications.presentation.badges.accepted'),
        title: i18n.t('notifications.presentation.titles.invitationAccepted'),
        eventTitle,
        iconName: 'checkmark-circle-outline',
        summary: actorLabel
          ? i18n.t('notifications.presentation.summaries.invitationAcceptedBy', { actor: actorLabel })
          : i18n.t('notifications.presentation.summaries.invitationAccepted'),
        metadata: [],
        actionLabel: i18n.t('notifications.presentation.actions.viewEvent'),
        actionTarget: 'EVENT',
      };
    case 'PRIVATE_EVENT_INVITATION_DECLINED':
      return {
        accentColor: '#B45309',
        accentBackgroundColor: '#FEF3C7',
        badgeLabel: i18n.t('notifications.presentation.badges.declined'),
        title: i18n.t('notifications.presentation.titles.invitationDeclined'),
        eventTitle,
        iconName: 'close-circle-outline',
        summary: actorLabel
          ? i18n.t('notifications.presentation.summaries.invitationDeclinedBy', { actor: actorLabel })
          : i18n.t('notifications.presentation.summaries.invitationDeclined'),
        metadata: [],
        actionLabel: i18n.t('notifications.presentation.actions.viewEvent'),
        actionTarget: 'EVENT',
      };
    default:
      return buildFallbackPresentation(notification);
  }
}
