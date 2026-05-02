export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';

export interface InvitationEventSummary {
  id: string;
  title: string;
  image_url: string | null;
  start_time: string;
}

export interface ReceivedInvitation {
  invitation_id: string;
  status: InvitationStatus;
  event: InvitationEventSummary;
  host: {
    username: string;
    display_name: string | null;
    profile_image_url: string | null;
  };
  message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReceivedInvitationsResponse {
  items: ReceivedInvitation[];
  total: number;
}

export interface AcceptInvitationResponse {
  message: string;
  event_id: string;
}

export interface DeclineInvitationResponse {
  message: string;
}
