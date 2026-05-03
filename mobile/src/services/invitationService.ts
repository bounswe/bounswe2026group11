import { apiGetAuth, apiPostAuth } from './api';
import {
  AcceptInvitationResponse,
  DeclineInvitationResponse,
  ReceivedInvitationsResponse,
} from '@/models/invitation';

/**
 * Fetches the current user's pending private-event invitations.
 */
export async function listMyInvitations(token: string): Promise<ReceivedInvitationsResponse> {
  return apiGetAuth<ReceivedInvitationsResponse>('/me/invitations', token);
}

/**
 * Accepts a pending invitation.
 */
export async function acceptInvitation(
  invitationId: string,
  token: string,
): Promise<AcceptInvitationResponse> {
  return apiPostAuth<AcceptInvitationResponse>(
    `/me/invitations/${invitationId}/accept`,
    {},
    token,
  );
}

/**
 * Declines a pending invitation.
 */
export async function declineInvitation(
  invitationId: string,
  token: string,
): Promise<DeclineInvitationResponse> {
  return apiPostAuth<DeclineInvitationResponse>(
    `/me/invitations/${invitationId}/decline`,
    {},
    token,
  );
}
