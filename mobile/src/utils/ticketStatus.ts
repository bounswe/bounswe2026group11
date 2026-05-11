import type { TicketRejectReason } from '@/models/ticket';
import type { TicketStatus } from '@/models/event';
import i18n from '@/i18n';

export interface TicketStatusBadgeColors {
  backgroundColor: string;
  textColor: string;
}

const TICKET_STATUS_COLORS: Record<TicketStatus, TicketStatusBadgeColors> = {
  ACTIVE: {
    backgroundColor: '#DCFCE7',
    textColor: '#16A34A',
  },
  PENDING: {
    backgroundColor: '#FEF3C7',
    textColor: '#D97706',
  },
  EXPIRED: {
    backgroundColor: '#FEF3C7',
    textColor: '#D97706',
  },
  USED: {
    backgroundColor: '#E2E8F0',
    textColor: '#64748B',
  },
  CANCELED: {
    backgroundColor: '#FEE2E2',
    textColor: '#EF4444',
  },
};

export function getTicketStatusBadgeColors(status: TicketStatus): TicketStatusBadgeColors {
  return TICKET_STATUS_COLORS[status];
}

export function formatTicketStatusLabel(status: TicketStatus): string {
  return i18n.t(`tickets.status.${status}`);
}

export function getAttendeeLabel(count?: number | null) {
  if (count == null) {
    return i18n.t('common.notAvailable');
  }
  return String(count);
}

export function getTicketScanRejectMessage(reason?: TicketRejectReason | null): string {
  if (!reason) return i18n.t('tickets.scan.rejectDefault');
  return i18n.t(`tickets.scan.rejectReasons.${reason}`, {
    defaultValue: i18n.t('tickets.scan.rejectDefault'),
  });
}

export function getTicketQrAccessMessage(reason?: string | null): string {
  if (!reason) return i18n.t('tickets.qr.accessUnavailable');
  return i18n.t(`tickets.qr.accessReasons.${reason}`, {
    defaultValue: i18n.t('tickets.qr.accessUnavailable'),
  });
}
