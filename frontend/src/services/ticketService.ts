import { apiGetAuth } from './api';
import type { ListTicketsResponse, TicketDetailResponse } from '@/models/ticket';

export function listMyTickets(token: string): Promise<ListTicketsResponse> {
  return apiGetAuth<ListTicketsResponse>('/me/tickets', token);
}

export function getMyTicket(
  ticketId: string,
  token: string,
): Promise<TicketDetailResponse> {
  return apiGetAuth<TicketDetailResponse>(`/me/tickets/${ticketId}`, token);
}
