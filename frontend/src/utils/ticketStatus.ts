import type { TicketStatus } from '@/models/ticket';

export interface TicketStatusPresentation {
  label: string;
  tone: 'active' | 'pending' | 'expired' | 'used' | 'canceled';
  description: string;
}

export function getTicketStatusPresentation(status: TicketStatus): TicketStatusPresentation {
  switch (status) {
    case 'ACTIVE':
      return {
        label: 'Active',
        tone: 'active',
        description: 'Ready to use. Show the live QR in the mobile app at the venue.',
      };
    case 'PENDING':
      return {
        label: 'Pending',
        tone: 'pending',
        description: 'Your ticket is being prepared. Check back closer to the event.',
      };
    case 'USED':
      return {
        label: 'Used',
        tone: 'used',
        description: 'This ticket was scanned at the event.',
      };
    case 'EXPIRED':
      return {
        label: 'Expired',
        tone: 'expired',
        description: 'This ticket has expired and can no longer be used.',
      };
    case 'CANCELED':
      return {
        label: 'Canceled',
        tone: 'canceled',
        description: 'This ticket is canceled and cannot be used.',
      };
    default:
      return {
        label: status,
        tone: 'pending',
        description: 'Ticket status unavailable.',
      };
  }
}
