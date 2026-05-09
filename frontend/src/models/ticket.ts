export type TicketStatus = 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'USED' | 'CANCELED';

export type TicketParticipationStatus = 'APPROVED' | 'PENDING' | 'CANCELED' | 'LEAVED';

export type TicketEventStatus = 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';

export interface TicketParticipation {
  id: string;
  status: TicketParticipationStatus;
}

export interface TicketEvent {
  id: string;
  title: string;
  status: TicketEventStatus;
  privacy_level: 'PUBLIC' | 'PROTECTED' | 'PRIVATE';
  start_time: string;
  end_time?: string | null;
  location_type: 'POINT' | 'ROUTE';
  address?: string | null;
}

export interface TicketListItem {
  ticket_id: string;
  status: TicketStatus;
  expires_at: string;
  event: TicketEvent;
  participation: TicketParticipation;
}

export interface ListTicketsResponse {
  items: TicketListItem[];
}

export interface TicketLocation {
  type: 'POINT' | 'ROUTE';
  address?: string | null;
  anchor_lat: number;
  anchor_lon: number;
}

export interface TicketQRAccess {
  requires_location_permission: boolean;
  requires_proximity: boolean;
  proximity_meters: number;
  eligible_now: boolean;
  reason?: string;
}

export interface TicketDetail {
  id: string;
  status: TicketStatus;
  expires_at: string;
  used_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketDetailResponse {
  ticket: TicketDetail;
  participation: TicketParticipation;
  event: TicketEvent;
  location: TicketLocation;
  qr_access: TicketQRAccess;
}
