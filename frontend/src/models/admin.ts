import type { UserRole } from '@/models/auth';

export interface AdminPageMeta {
  limit: number;
  offset: number;
  total_count: number;
  has_next: boolean;
}

export interface AdminListResponse<T> extends AdminPageMeta {
  items: T[];
}

export interface AdminPageParams {
  limit: number;
  offset: number;
}

export interface AdminUserFilters {
  q?: string;
  status?: 'active' | 'deactivated' | '';
  role?: UserRole;
  created_from?: string;
  created_to?: string;
}

export interface AdminEventFilters {
  q?: string;
  host_id?: string;
  category_id?: string;
  privacy_level?: 'PUBLIC' | 'PROTECTED' | 'PRIVATE';
  status?: 'ACTIVE' | 'IN_PROGRESS' | 'CANCELED' | 'COMPLETED';
  start_from?: string;
  start_to?: string;
}

export interface AdminParticipationFilters {
  q?: string;
  status?: 'APPROVED' | 'PENDING' | 'CANCELED' | 'LEAVED';
  event_id?: string;
  user_id?: string;
  created_from?: string;
  created_to?: string;
}

export interface AdminTicketFilters {
  q?: string;
  status?: 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'USED' | 'CANCELED';
  event_id?: string;
  user_id?: string;
  participation_id?: string;
  created_from?: string;
  created_to?: string;
}

export interface AdminNotificationFilters {
  q?: string;
  user_id?: string;
  event_id?: string;
  type?: string;
  is_read?: string;
  created_from?: string;
  created_to?: string;
}

export interface AdminEventReportFilters {
  q?: string;
  status?: 'PENDING' | 'REVIEWED' | 'DISMISSED';
  report_category?:
    | 'SAFETY'
    | 'HARASSMENT'
    | 'SPAM_OR_SCAM'
    | 'INAPPROPRIATE_CONTENT'
    | 'EVENT_NOT_AS_DESCRIBED'
    | 'ILLEGAL_OR_DANGEROUS'
    | 'OTHER';
  event_id?: string;
  reporter_user_id?: string;
  created_from?: string;
  created_to?: string;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  phone_number: string | null;
  email_verified: boolean;
  last_login: string | null;
  status: 'active' | 'deactivated';
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface AdminEvent {
  id: string;
  host_id: string;
  host_username: string;
  title: string;
  category_id: number | null;
  category_name: string | null;
  start_time: string;
  end_time: string | null;
  privacy_level: 'PUBLIC' | 'PROTECTED' | 'PRIVATE';
  status: 'ACTIVE' | 'IN_PROGRESS' | 'CANCELED' | 'COMPLETED';
  capacity: number | null;
  approved_participant_count: number;
  pending_participant_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminParticipation {
  id: string;
  event_id: string;
  event_title: string;
  user_id: string;
  username: string;
  user_email: string;
  status: 'APPROVED' | 'PENDING' | 'CANCELED' | 'LEAVED';
  reconfirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminTicket {
  id: string;
  participation_id: string;
  event_id: string;
  event_title: string;
  user_id: string;
  username: string;
  user_email: string;
  status: 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'USED' | 'CANCELED';
  expires_at: string;
  used_at: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminNotification {
  id: string;
  receiver_user_id: string;
  username: string;
  user_email: string;
  event_id: string | null;
  event_title: string | null;
  title: string;
  type: string | null;
  body: string;
  deep_link: string | null;
  data: Record<string, string>;
  is_read: boolean;
  read_at: string | null;
  deleted_at: string | null;
  sse_sent_count: number;
  push_sent_count: number;
  push_failed_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminEventReport {
  id: string;
  event_id: string;
  event_title: string | null;
  reporter_user_id: string;
  reporter_username: string | null;
  reporter_email: string | null;
  report_category:
    | 'SAFETY'
    | 'HARASSMENT'
    | 'SPAM_OR_SCAM'
    | 'INAPPROPRIATE_CONTENT'
    | 'EVENT_NOT_AS_DESCRIBED'
    | 'ILLEGAL_OR_DANGEROUS'
    | 'OTHER';
  message: string;
  image_url: string | null;
  status: 'PENDING' | 'REVIEWED' | 'DISMISSED';
  created_at: string;
  updated_at: string;
}

export interface AdminCategory {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface AdminCreateCategoryRequest {
  name: string;
}

export interface AdminUpdateStatusRequest<T extends string = string> {
  status: T;
  reason?: string | null;
}

export interface AdminReasonRequest {
  reason?: string | null;
}

export interface AdminCancelEventResponse {
  event_id: string;
  status: 'CANCELED';
  already_canceled: boolean;
}

export interface AdminDeactivateUserResponse {
  user_id: string;
  status: 'deactivated';
  already_deactivated: boolean;
  canceled_event_count: number;
}

export type AdminInvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELED';
export interface AdminInvitationFilters {
  q?: string;
  status?: AdminInvitationStatus;
  event_id?: string;
  host_id?: string;
  invited_user_id?: string;
  created_from?: string;
  created_to?: string;
}
export interface AdminInvitation {
  id: string;
  event_id: string;
  event_title: string;
  host_id: string;
  host_username: string;
  invited_user_id: string;
  invited_username: string;
  invited_email: string;
  status: AdminInvitationStatus;
  message: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AdminJoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';
export interface AdminJoinRequestFilters {
  q?: string;
  status?: AdminJoinRequestStatus;
  event_id?: string;
  user_id?: string;
  host_user_id?: string;
  created_from?: string;
  created_to?: string;
}
export interface AdminJoinRequest {
  id: string;
  event_id: string;
  event_title: string;
  user_id: string;
  username: string;
  user_email: string;
  host_user_id: string;
  host_username: string;
  status: AdminJoinRequestStatus;
  message: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminCommentFilters {
  q?: string;
  event_id?: string;
  user_id?: string;
  type?: 'DISCUSSION' | 'REVIEW';
  created_from?: string;
  created_to?: string;
}
export interface AdminComment {
  id: string;
  event_id: string;
  event_title: string;
  user_id: string;
  username: string;
  user_email: string;
  type: 'DISCUSSION' | 'REVIEW';
  parent_id: string | null;
  message: string;
  created_at: string;
  updated_at: string;
}

export interface AdminRatingFilters {
  event_id?: string;
  user_id?: string;
  host_id?: string;
  created_from?: string;
  created_to?: string;
}
export interface AdminEventRating {
  id: string;
  event_id: string;
  event_title: string;
  participant_user_id: string;
  username: string;
  user_email: string;
  score: number;
  created_at: string;
  updated_at: string;
}
export interface AdminParticipantRating {
  id: string;
  event_id: string;
  event_title: string;
  host_user_id: string;
  host_username: string;
  participant_user_id: string;
  participant_username: string;
  score: number;
  created_at: string;
  updated_at: string;
}

export interface AdminFavoriteFilters {
  q?: string;
  user_id?: string;
  event_id?: string;
  created_from?: string;
  created_to?: string;
}
export interface AdminFavoriteEvent {
  id: string;
  user_id: string;
  username: string;
  user_email: string;
  event_id: string;
  event_title: string;
  created_at: string;
  updated_at: string;
}
export interface AdminFavoriteLocation {
  id: string;
  user_id: string;
  username: string;
  user_email: string;
  name: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserBadgeFilters {
  q?: string;
  user_id?: string;
}
export interface AdminUserBadge {
  user_id: string;
  username: string;
  user_email: string;
  badge_id: number;
  badge_slug: string;
  badge_name: string;
  badge_category: string;
  earned_at: string;
}

export interface AdminPushDeviceFilters {
  user_id?: string;
  platform?: 'IOS' | 'ANDROID';
  active?: string;
  created_from?: string;
  created_to?: string;
}
export interface AdminPushDevice {
  id: string;
  user_id: string;
  username: string;
  user_email: string;
  installation_id: string;
  platform: 'IOS' | 'ANDROID';
  last_seen_at: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AdminNotificationDeliveryMode = 'IN_APP' | 'PUSH' | 'BOTH';

export interface AdminCreateNotificationRequest {
  user_ids: string[];
  delivery_mode: AdminNotificationDeliveryMode;
  title: string;
  body: string;
  type?: string | null;
  deep_link?: string | null;
  event_id?: string | null;
  data?: Record<string, string>;
}

export interface AdminCreateNotificationResponse {
  target_user_count: number;
  created_count: number;
  idempotent_count: number;
  sse_delivery_count: number;
  push_active_device_count: number;
  push_sent_count: number;
  push_failed_count: number;
  invalid_token_count: number;
}

export interface AdminCreateParticipationRequest {
  event_id: string;
  user_id: string;
  status?: 'APPROVED' | 'PENDING';
  reason?: string | null;
}

export interface AdminCreateParticipationResponse {
  participation_id: string;
  event_id: string;
  user_id: string;
  status: 'APPROVED' | 'PENDING';
  ticket_id?: string;
  ticket_status?: 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'USED' | 'CANCELED';
}

export interface AdminCancelParticipationRequest {
  reason?: string | null;
}

export interface AdminCancelParticipationResponse {
  participation_id: string;
  event_id: string;
  user_id: string;
  status: 'CANCELED';
  already_canceled: boolean;
}
