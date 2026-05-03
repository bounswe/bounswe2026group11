import type { TicketRejectReason } from '@/models/ticket';
import type { TicketStatus } from '@/models/event';

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
    backgroundColor: '#E2E8F0',
    textColor: '#64748B',
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

const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  ACTIVE: 'Valid',
  PENDING: 'Pending',
  EXPIRED: 'Expired',
  USED: 'Used',
  CANCELED: 'Canceled',
};

const SCAN_REJECT_MESSAGES: Record<TicketRejectReason, string> = {
  INVALID_TOKEN: 'This QR token is invalid.',
  TICKET_NOT_FOUND: 'No ticket was found for this token.',
  TICKET_ALREADY_USED: 'This ticket was already used.',
  TICKET_NOT_ACTIVE: 'This ticket is not active.',
  PARTICIPATION_INVALID: 'This participant is not eligible for entry.',
  EVENT_INVALID: 'This event is not accepting ticket entry right now.',
  TOKEN_OLD_VERSION: 'This QR code is outdated.',
  TOKEN_NOT_LATEST: 'A newer QR token has already been issued.',
  EVENT_MISMATCH: 'This QR code belongs to a different event.',
  PARTICIPATION_MISMATCH: 'This ticket no longer matches its participant.',
};

const QR_ACCESS_MESSAGES: Record<string, string> = {
  PARTICIPATION_PENDING_REAPPROVAL: 'Your participation is pending approval before ticket access is enabled.',
  TICKET_NOT_ACTIVE: 'This ticket is not active right now.',
  EVENT_NOT_ACTIVE: 'The event is not currently accepting ticket access.',
  EVENT_NOT_PROTECTED: 'Only protected events have mobile tickets.',
  TICKET_EXPIRED: 'This ticket has expired.',
  PROXIMITY_REQUIRED: 'Move closer to the event location to reveal your live QR token.',
};

export function getTicketStatusBadgeColors(status: TicketStatus): TicketStatusBadgeColors {
  return TICKET_STATUS_COLORS[status];
}

export function formatTicketStatusLabel(status: TicketStatus): string {
  return TICKET_STATUS_LABELS[status];
}

export function getTicketScanRejectMessage(reason?: TicketRejectReason | null): string {
  if (!reason) return 'This ticket could not be validated.';
  return SCAN_REJECT_MESSAGES[reason] ?? 'This ticket could not be validated.';
}

export function getTicketQrAccessMessage(reason?: string | null): string {
  if (!reason) return 'Ticket access is not available yet.';
  return QR_ACCESS_MESSAGES[reason] ?? 'Ticket access is not available yet.';
}
