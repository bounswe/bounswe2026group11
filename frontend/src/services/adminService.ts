import { apiGetAuth } from '@/services/api';
import type {
  AdminEvent,
  AdminEventFilters,
  AdminListResponse,
  AdminPageParams,
  AdminParticipation,
  AdminParticipationFilters,
  AdminTicket,
  AdminTicketFilters,
  AdminUser,
  AdminUserFilters,
} from '@/models/admin';

const RFC3339_FILTER_KEYS = new Set([
  'created_from',
  'created_to',
  'start_from',
  'start_to',
]);

function serializeAdminQueryValue(key: string, value: string | number | boolean): string {
  if (typeof value === 'string' && RFC3339_FILTER_KEYS.has(key)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return String(value);
}

export function buildAdminListPath(path: string, params: object): string {
  const qs = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    qs.set(key, serializeAdminQueryValue(key, value));
  });

  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}

export function listAdminUsers(
  token: string,
  params: AdminPageParams & AdminUserFilters,
): Promise<AdminListResponse<AdminUser>> {
  return apiGetAuth<AdminListResponse<AdminUser>>(buildAdminListPath('/admin/users', params), token);
}

export function listAdminEvents(
  token: string,
  params: AdminPageParams & AdminEventFilters,
): Promise<AdminListResponse<AdminEvent>> {
  return apiGetAuth<AdminListResponse<AdminEvent>>(buildAdminListPath('/admin/events', params), token);
}

export function listAdminParticipations(
  token: string,
  params: AdminPageParams & AdminParticipationFilters,
): Promise<AdminListResponse<AdminParticipation>> {
  return apiGetAuth<AdminListResponse<AdminParticipation>>(
    buildAdminListPath('/admin/participations', params),
    token,
  );
}

export function listAdminTickets(
  token: string,
  params: AdminPageParams & AdminTicketFilters,
): Promise<AdminListResponse<AdminTicket>> {
  return apiGetAuth<AdminListResponse<AdminTicket>>(buildAdminListPath('/admin/tickets', params), token);
}
