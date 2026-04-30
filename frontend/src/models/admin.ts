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
  status?: string;
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

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  phone_number: string | null;
  email_verified: boolean;
  last_login: string | null;
  status: string;
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
