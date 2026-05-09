import { apiGetAuth, apiPostAuth, apiDeleteAuth } from './api';
import {
  AcceptInvitationResponse,
  DeclineInvitationResponse,
  ReceivedInvitationsResponse,
} from '@/models/invitation';

/**
 * Fetches the current user's invitations grouped into pending and past buckets.
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

/**
 * Revokes a pending invitation (Host only).
 */
export async function revokeInvitation(
  eventId: string,
  invitationId: string,
  token: string,
): Promise<void> {
  return apiDeleteAuth<void>(`/events/${eventId}/invitations/${invitationId}`, token);
}
