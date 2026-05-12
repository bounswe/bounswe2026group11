import i18n from '@/i18n';

export type EventLifecycleVariant = 'upcoming' | 'in_progress';
export type EventCardBadgeVariant = EventLifecycleVariant | 'canceled' | 'completed';

export interface EventLifecyclePresentation {
  label: string;
  variant: EventLifecycleVariant;
}

export interface EventCardBadgePresentation {
  label: string;
  variant: EventCardBadgeVariant;
}

/** Labels and styling for ACTIVE (shown as UPCOMING) and IN_PROGRESS on cards and detail. */
export function getEventLifecyclePresentation(status: string): EventLifecyclePresentation | null {
  if (status === 'ACTIVE') {
    return { label: i18n.t('events.status.UPCOMING'), variant: 'upcoming' };
  }
  if (status === 'IN_PROGRESS') {
    return { label: i18n.t('events.status.IN_PROGRESS_BADGE'), variant: 'in_progress' };
  }
  return null;
}

export function getEventCardBadgePresentation(status: string): EventCardBadgePresentation | null {
  if (status === 'ACTIVE') {
    return { label: i18n.t('events.status.UPCOMING'), variant: 'upcoming' };
  }
  if (status === 'IN_PROGRESS') {
    return { label: i18n.t('events.status.IN_PROGRESS_BADGE'), variant: 'in_progress' };
  }
  if (status === 'CANCELED') {
    return { label: i18n.t('events.status.CANCELED_BADGE'), variant: 'canceled' };
  }
  if (status === 'COMPLETED') {
    return { label: i18n.t('events.status.COMPLETED_BADGE'), variant: 'completed' };
  }
  return null;
}

export interface EventStatusPresentation {
  label: string;
  tone: 'active' | 'canceled' | 'completed';
}

export function getEventStatusPresentation(status: string): EventStatusPresentation {
  switch (status) {
    case 'ACTIVE':
      return { label: i18n.t('events.status.ACTIVE'), tone: 'active' };
    case 'IN_PROGRESS':
      return { label: i18n.t('events.status.IN_PROGRESS'), tone: 'active' };
    case 'CANCELED':
      return { label: i18n.t('events.status.CANCELED'), tone: 'canceled' };
    case 'COMPLETED':
      return { label: i18n.t('events.status.COMPLETED'), tone: 'completed' };
    default:
      return {
        label: status
          .toLowerCase()
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ') || i18n.t('events.status.UNKNOWN'),
        tone: 'completed',
      };
  }
}

export function shouldShowProfileEvent(status: string): boolean {
  return status !== 'ACTIVE';
}
