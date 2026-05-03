import type { TicketStatus } from '@/models/event';

export type TicketParticipationStatus = 'APPROVED' | 'PENDING' | 'CANCELED' | 'LEAVED';
export type TicketEventStatus = 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
export type TicketLocationType = 'POINT' | 'ROUTE';

export type TicketRejectReason =
  | 'INVALID_TOKEN'
  | 'TICKET_NOT_FOUND'
  | 'TICKET_ALREADY_USED'
  | 'TICKET_NOT_ACTIVE'
  | 'PARTICIPATION_INVALID'
  | 'EVENT_INVALID'
  | 'TOKEN_OLD_VERSION'
  | 'TOKEN_NOT_LATEST'
  | 'EVENT_MISMATCH'
  | 'PARTICIPATION_MISMATCH';

export interface TicketParticipationSummary {
  id: string;
  status: TicketParticipationStatus;
}

export interface TicketEventSummary {
  id: string;
  title: string;
  status: TicketEventStatus;
  privacy_level: 'PROTECTED';
  start_time: string;
  end_time?: string | null;
  location_type: TicketLocationType;
  address?: string | null;
}

export interface TicketListItem {
  ticket_id: string;
  status: TicketStatus;
  expires_at: string;
  event: TicketEventSummary;
  participation: TicketParticipationSummary;
}

export interface ListTicketsResponse {
  items: TicketListItem[];
}

export interface TicketDetailResponse {
  ticket: {
    id: string;
    status: TicketStatus;
    expires_at: string;
    used_at?: string | null;
    created_at: string;
    updated_at: string;
  };
  participation: TicketParticipationSummary;
  event: TicketEventSummary;
  location: {
    type: TicketLocationType;
    address?: string | null;
    anchor_lat: number;
    anchor_lon: number;
  };
  qr_access: {
    requires_location_permission: boolean;
    requires_proximity: boolean;
    proximity_meters: number;
    eligible_now: boolean;
    reason?: string | null;
  };
}

export interface TicketQrToken {
  token: string;
  expires_at: string;
  version: number;
}

export interface TicketScanResponse {
  result: 'ACCEPTED' | 'REJECTED';
  reason?: TicketRejectReason | null;
  ticket_id?: string | null;
  participation_id?: string | null;
  user_id?: string | null;
  ticket_status?: TicketStatus | null;
}
