import i18n from '@/i18n';
import type { MyEventStatus } from '@/models/event';

export interface EventStatusBadgeColors {
  backgroundColor: string;
  textColor: string;
}

const KNOWN_STATUSES: MyEventStatus[] = ['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'];

const STATUS_BADGE_COLORS: Record<MyEventStatus, EventStatusBadgeColors> = {
  ACTIVE: {
    backgroundColor: '#DCFCE7',
    textColor: '#166534',
  },
  IN_PROGRESS: {
    backgroundColor: '#DBEAFE',
    textColor: '#1D4ED8',
  },
  COMPLETED: {
    backgroundColor: '#E2E8F0',
    textColor: '#334155',
  },
  CANCELED: {
    backgroundColor: '#FEE2E2',
    textColor: '#B91C1C',
  },
};

const DEFAULT_STATUS_BADGE_COLORS: EventStatusBadgeColors = {
  backgroundColor: 'rgba(255, 255, 255, 0.92)',
  textColor: '#111827',
};

export function formatEventStatusLabel(status: string): string {
  const normalized = status.trim();
  if (!normalized) return i18n.t('events.status.Unknown');

  if (KNOWN_STATUSES.includes(normalized as MyEventStatus)) {
    return i18n.t(`events.status.${normalized}`);
  }

  const formatted = normalized
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return formatted || i18n.t('events.status.Unknown');
}

export function getEventStatusBadgeColors(status: string): EventStatusBadgeColors {
  return STATUS_BADGE_COLORS[status as MyEventStatus] ?? DEFAULT_STATUS_BADGE_COLORS;
}

export function shouldShowProfileEvent(status: string): boolean {
  return status !== 'ACTIVE';
}
