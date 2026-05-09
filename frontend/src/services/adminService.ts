import { apiDeleteAuth, apiGetAuth, apiPatchAuth, apiPostAuth } from '@/services/api';
import type {
  AdminCancelParticipationRequest,
  AdminCancelParticipationResponse,
  AdminCreateNotificationRequest,
  AdminCreateNotificationResponse,
  AdminCreateParticipationRequest,
  AdminCreateParticipationResponse,
  AdminEvent,
  AdminEventFilters,
  AdminCancelEventResponse,
  AdminCategory,
  AdminComment,
  AdminCommentFilters,
  AdminCreateCategoryRequest,
  AdminEventReport,
  AdminEventReportFilters,
  AdminEventRating,
  AdminFavoriteEvent,
  AdminFavoriteFilters,
  AdminFavoriteLocation,
  AdminInvitation,
  AdminInvitationFilters,
  AdminJoinRequest,
  AdminJoinRequestFilters,
  AdminListResponse,
  AdminNotification,
  AdminNotificationFilters,
  AdminPageParams,
  AdminParticipation,
  AdminParticipationFilters,
  AdminParticipantRating,
  AdminPushDevice,
  AdminPushDeviceFilters,
  AdminRatingFilters,
  AdminReasonRequest,
  AdminTicket,
  AdminTicketFilters,
  AdminUpdateStatusRequest,
  AdminUser,
  AdminUserBadge,
  AdminUserBadgeFilters,
  AdminDeactivateUserResponse,
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

export function listAdminNotifications(
  token: string,
  params: AdminPageParams & AdminNotificationFilters,
): Promise<AdminListResponse<AdminNotification>> {
  return apiGetAuth<AdminListResponse<AdminNotification>>(buildAdminListPath('/admin/notifications', params), token);
}

export function listAdminEventReports(
  token: string,
  params: AdminPageParams & AdminEventReportFilters,
): Promise<AdminListResponse<AdminEventReport>> {
  return apiGetAuth<AdminListResponse<AdminEventReport>>(
    buildAdminListPath('/admin/event-reports', params),
    token,
  );
}

export function updateAdminEventReportStatus(
  token: string,
  reportId: string,
  body: AdminUpdateStatusRequest<AdminEventReport['status']>,
): Promise<AdminEventReport> {
  return apiPatchAuth<AdminEventReport>(`/admin/event-reports/${encodeURIComponent(reportId)}/status`, body, token);
}

export function listAdminCategories(token: string): Promise<{ items: AdminCategory[] }> {
  return apiGetAuth<{ items: AdminCategory[] }>('/admin/categories', token);
}

export function createAdminCategory(token: string, body: AdminCreateCategoryRequest): Promise<AdminCategory> {
  return apiPostAuth<AdminCategory>('/admin/categories', body, token);
}

export function deleteAdminCategory(token: string, categoryId: number): Promise<void> {
  return apiDeleteAuth<void>(`/admin/categories/${encodeURIComponent(String(categoryId))}`, token);
}

export function updateAdminEventStatus(
  token: string,
  eventId: string,
  body: AdminUpdateStatusRequest<AdminEvent['status']>,
): Promise<AdminEvent> {
  return apiPatchAuth<AdminEvent>(`/admin/events/${encodeURIComponent(eventId)}/status`, body, token);
}

export function cancelAdminEvent(token: string, eventId: string, body: AdminReasonRequest = {}): Promise<AdminCancelEventResponse> {
  return apiPostAuth<AdminCancelEventResponse>(`/admin/events/${encodeURIComponent(eventId)}/cancel`, body, token);
}

export function deactivateAdminUser(token: string, userId: string, body: AdminReasonRequest = {}): Promise<AdminDeactivateUserResponse> {
  return apiPostAuth<AdminDeactivateUserResponse>(`/admin/users/${encodeURIComponent(userId)}/deactivate`, body, token);
}

export function listAdminInvitations(
  token: string,
  params: AdminPageParams & AdminInvitationFilters,
): Promise<AdminListResponse<AdminInvitation>> {
  return apiGetAuth<AdminListResponse<AdminInvitation>>(buildAdminListPath('/admin/invitations', params), token);
}

export function updateAdminInvitationStatus(
  token: string,
  invitationId: string,
  body: AdminUpdateStatusRequest<AdminInvitation['status']>,
): Promise<AdminInvitation> {
  return apiPatchAuth<AdminInvitation>(`/admin/invitations/${encodeURIComponent(invitationId)}/status`, body, token);
}

export function listAdminJoinRequests(
  token: string,
  params: AdminPageParams & AdminJoinRequestFilters,
): Promise<AdminListResponse<AdminJoinRequest>> {
  return apiGetAuth<AdminListResponse<AdminJoinRequest>>(buildAdminListPath('/admin/join-requests', params), token);
}

export function updateAdminJoinRequestStatus(
  token: string,
  joinRequestId: string,
  body: AdminUpdateStatusRequest<AdminJoinRequest['status']>,
): Promise<AdminJoinRequest> {
  return apiPatchAuth<AdminJoinRequest>(`/admin/join-requests/${encodeURIComponent(joinRequestId)}/status`, body, token);
}

export function listAdminComments(
  token: string,
  params: AdminPageParams & AdminCommentFilters,
): Promise<AdminListResponse<AdminComment>> {
  return apiGetAuth<AdminListResponse<AdminComment>>(buildAdminListPath('/admin/comments', params), token);
}

export function deleteAdminComment(token: string, commentId: string): Promise<void> {
  return apiDeleteAuth<void>(`/admin/comments/${encodeURIComponent(commentId)}`, token);
}

export function listAdminEventRatings(
  token: string,
  params: AdminPageParams & AdminRatingFilters,
): Promise<AdminListResponse<AdminEventRating>> {
  return apiGetAuth<AdminListResponse<AdminEventRating>>(buildAdminListPath('/admin/ratings/events', params), token);
}

export function deleteAdminEventRating(token: string, ratingId: string): Promise<void> {
  return apiDeleteAuth<void>(`/admin/ratings/events/${encodeURIComponent(ratingId)}`, token);
}

export function listAdminParticipantRatings(
  token: string,
  params: AdminPageParams & AdminRatingFilters,
): Promise<AdminListResponse<AdminParticipantRating>> {
  return apiGetAuth<AdminListResponse<AdminParticipantRating>>(buildAdminListPath('/admin/ratings/participants', params), token);
}

export function deleteAdminParticipantRating(token: string, ratingId: string): Promise<void> {
  return apiDeleteAuth<void>(`/admin/ratings/participants/${encodeURIComponent(ratingId)}`, token);
}

export function listAdminFavoriteEvents(
  token: string,
  params: AdminPageParams & AdminFavoriteFilters,
): Promise<AdminListResponse<AdminFavoriteEvent>> {
  return apiGetAuth<AdminListResponse<AdminFavoriteEvent>>(buildAdminListPath('/admin/favorites/events', params), token);
}

export function listAdminFavoriteLocations(
  token: string,
  params: AdminPageParams & AdminFavoriteFilters,
): Promise<AdminListResponse<AdminFavoriteLocation>> {
  return apiGetAuth<AdminListResponse<AdminFavoriteLocation>>(buildAdminListPath('/admin/favorites/locations', params), token);
}

export function listAdminUserBadges(
  token: string,
  params: AdminPageParams & AdminUserBadgeFilters,
): Promise<AdminListResponse<AdminUserBadge>> {
  return apiGetAuth<AdminListResponse<AdminUserBadge>>(buildAdminListPath('/admin/badges/users', params), token);
}

export function listAdminPushDevices(
  token: string,
  params: AdminPageParams & AdminPushDeviceFilters,
): Promise<AdminListResponse<AdminPushDevice>> {
  return apiGetAuth<AdminListResponse<AdminPushDevice>>(buildAdminListPath('/admin/push-devices', params), token);
}

export function revokeAdminPushDevice(token: string, deviceId: string, body: AdminReasonRequest = {}): Promise<void> {
  return apiPostAuth<void>(`/admin/push-devices/${encodeURIComponent(deviceId)}/revoke`, body, token);
}

export function createAdminNotification(
  token: string,
  body: AdminCreateNotificationRequest,
): Promise<AdminCreateNotificationResponse> {
  return apiPostAuth<AdminCreateNotificationResponse>('/admin/notifications', body, token);
}

export function createAdminParticipation(
  token: string,
  body: AdminCreateParticipationRequest,
): Promise<AdminCreateParticipationResponse> {
  return apiPostAuth<AdminCreateParticipationResponse>('/admin/participations', body, token);
}

export function cancelAdminParticipation(
  token: string,
  participationId: string,
  body: AdminCancelParticipationRequest = {},
): Promise<AdminCancelParticipationResponse> {
  return apiPostAuth<AdminCancelParticipationResponse>(
    `/admin/participations/${encodeURIComponent(participationId)}/cancel`,
    body,
    token,
  );
}
