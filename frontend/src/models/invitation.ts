/* ── Participant-side invitations (received) ── */

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

export interface InvitationEventSummary {
  id: string;
  title: string;
  image_url?: string | null;
  start_time: string;
  end_time?: string | null;
  status: 'ACTIVE' | 'IN_PROGRESS';
  privacy_level: 'PRIVATE';
  approved_participant_count: number;
}

export interface InvitationHostSummary {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

export interface ReceivedInvitation {
  invitation_id: string;
  status: InvitationStatus;
  message: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  event: InvitationEventSummary;
  host: InvitationHostSummary;
}

export interface ReceivedInvitationsResponse {
  items: ReceivedInvitation[];
}

export interface AcceptInvitationResponse {
  invitation_id: string;
  event_id: string;
  invitation_status: 'ACCEPTED';
  participation_id: string;
  participation_status: 'APPROVED';
  updated_at: string;
}

export interface DeclineInvitationResponse {
  invitation_id: string;
  event_id: string;
  status: 'DECLINED';
  updated_at: string;
  cooldown_ends_at: string;
}

/* ── Host-side invitation creation ── */

export type InvitationFailureCode =
  | 'ALREADY_INVITED'
  | 'ALREADY_PARTICIPATING'
  | 'HOST_USER'
  | 'DECLINE_COOLDOWN_ACTIVE'
  | 'CAPACITY_EXCEEDED'
  | 'DUPLICATE_USERNAME';

export interface EventInvitationFailure {
  username: string;
  code: InvitationFailureCode;
}

export interface CreatedEventInvitation {
  invitation_id: string;
  event_id: string;
  invited_user_id: string;
  username: string;
  status: 'PENDING';
  created_at: string;
}

export interface CreateEventInvitationsRequest {
  usernames: string[];
  message?: string | null;
}

export interface CreateEventInvitationsResponse {
  success_count: number;
  invalid_username_count: number;
  failed_count: number;
  successful_invitations: CreatedEventInvitation[];
  invalid_usernames: string[];
  failed: EventInvitationFailure[];
}
