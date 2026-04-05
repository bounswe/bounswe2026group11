import type { MyEventStatus } from '@/models/event';

export interface EventStatusBadgeColors {
  backgroundColor: string;
  textColor: string;
}

const STATUS_LABELS: Record<MyEventStatus, string> = {
  ACTIVE: 'Active',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELED: 'Canceled',
};

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
  if (!normalized) return 'Unknown';

  const knownLabel = STATUS_LABELS[normalized as MyEventStatus];
  if (knownLabel) return knownLabel;

  const formatted = normalized
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return formatted || 'Unknown';
}

export function getEventStatusBadgeColors(status: string): EventStatusBadgeColors {
  return STATUS_BADGE_COLORS[status as MyEventStatus] ?? DEFAULT_STATUS_BADGE_COLORS;
}

export function shouldShowProfileEvent(status: string): boolean {
  return status !== 'ACTIVE';
}
