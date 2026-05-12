import type { TicketStatus } from '@/models/ticket';
import i18n from '@/i18n';

export interface TicketStatusPresentation {
  label: string;
  tone: 'active' | 'pending' | 'expired' | 'used' | 'canceled';
  description: string;
}

export function getTicketStatusPresentation(status: TicketStatus): TicketStatusPresentation {
  switch (status) {
    case 'ACTIVE':
      return {
        label: i18n.t('tickets.status.ACTIVE'),
        tone: 'active',
        description: i18n.t('tickets.status_descriptions.ACTIVE'),
      };
    case 'PENDING':
      return {
        label: i18n.t('tickets.status.PENDING'),
        tone: 'pending',
        description: i18n.t('tickets.status_descriptions.PENDING'),
      };
    case 'USED':
      return {
        label: i18n.t('tickets.status.USED'),
        tone: 'used',
        description: i18n.t('tickets.status_descriptions.USED'),
      };
    case 'EXPIRED':
      return {
        label: i18n.t('tickets.status.EXPIRED'),
        tone: 'expired',
        description: i18n.t('tickets.status_descriptions.EXPIRED'),
      };
    case 'CANCELED':
      return {
        label: i18n.t('tickets.status.CANCELED'),
        tone: 'canceled',
        description: i18n.t('tickets.status_descriptions.CANCELED'),
      };
    default:
      return {
        label: status,
        tone: 'pending',
        description: i18n.t('tickets.status_descriptions.UNKNOWN'),
      };
  }
}
