import { apiGetAuth, apiPostAuth } from './api';
import type {
  AcceptInvitationResponse,
  DeclineInvitationResponse,
  ReceivedInvitationsResponse,
} from '@/models/invitation';

export function listMyInvitations(token: string): Promise<ReceivedInvitationsResponse> {
  return apiGetAuth<ReceivedInvitationsResponse>('/me/invitations', token);
}

export function acceptInvitation(
  invitationId: string,
  token: string,
): Promise<AcceptInvitationResponse> {
  return apiPostAuth<AcceptInvitationResponse>(
    `/me/invitations/${invitationId}/accept`,
    {},
    token,
  );
}

export function declineInvitation(
  invitationId: string,
  token: string,
): Promise<DeclineInvitationResponse> {
  return apiPostAuth<DeclineInvitationResponse>(
    `/me/invitations/${invitationId}/decline`,
    {},
    token,
  );
}
