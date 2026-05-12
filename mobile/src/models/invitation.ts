export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELED' | 'EXPIRED';

export interface InvitationEventSummary {
  id: string;
  title: string;
  image_url?: string | null;
  start_time: string;
  end_time?: string | null;
  status?: 'ACTIVE' | 'IN_PROGRESS';
  privacy_level?: 'PRIVATE';
  approved_participant_count?: number;
}

export interface ReceivedInvitation {
  invitation_id: string;
  status: InvitationStatus;
  event: InvitationEventSummary;
  host: {
    id?: string;
    username: string;
    display_name: string | null;
    profile_image_url: string | null;
    avatar_url?: string | null;
  };
  message: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvitationPageInfo {
  next_cursor: string | null;
  has_next: boolean;
}

export interface ReceivedInvitationsPast {
  items: ReceivedInvitation[];
  page_info: InvitationPageInfo;
}

export interface ReceivedInvitationsResponse {
  pending: ReceivedInvitation[];
  past: ReceivedInvitationsPast;
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
