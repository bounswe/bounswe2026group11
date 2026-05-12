import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  listMyInvitations,
  acceptInvitation,
  declineInvitation,
} from '@/services/invitationService';
import { ReceivedInvitation } from '@/models/invitation';
import { ApiError } from '@/services/api';
import i18n from '@/i18n';

export interface InvitationsViewModel {
  invitations: ReceivedInvitation[];
  isLoading: boolean;
  isActionLoading: string | null; // Stores invitation_id of the currently acting invitation
  error: string | null;
  fetchInvitations: () => Promise<void>;
  handleAccept: (invitationId: string) => Promise<void>;
  handleDecline: (invitationId: string) => Promise<void>;
}

function getPendingInvitations(
  response: Awaited<ReturnType<typeof listMyInvitations>>,
): ReceivedInvitation[] {
  return (response.pending ?? []).filter(
    (invitation) => invitation.status === 'PENDING',
  );
}

export function useInvitationsViewModel(): InvitationsViewModel {
  const { token } = useAuth();
  const [invitations, setInvitations] = useState<ReceivedInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    if (!token) {
      setInvitations([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await listMyInvitations(token);
      setInvitations(getPendingInvitations(response));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(i18n.t('profile.invitations.loadFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const handleAccept = useCallback(
    async (invitationId: string) => {
      if (!token) return;
      setIsActionLoading(invitationId);
      try {
        await acceptInvitation(invitationId, token);
        setInvitations((prev) =>
          prev.filter((invitation) => invitation.invitation_id !== invitationId),
        );
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(i18n.t('profile.invitations.acceptFailed'));
        }
      } finally {
        setIsActionLoading(null);
      }
    },
    [token],
  );

  const handleDecline = useCallback(
    async (invitationId: string) => {
      if (!token) return;
      setIsActionLoading(invitationId);
      try {
        await declineInvitation(invitationId, token);
        setInvitations((prev) =>
          prev.filter((invitation) => invitation.invitation_id !== invitationId),
        );
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(i18n.t('profile.invitations.declineFailed'));
        }
      } finally {
        setIsActionLoading(null);
      }
    },
    [token],
  );

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  return {
    invitations,
    isLoading,
    isActionLoading,
    error,
    fetchInvitations,
    handleAccept,
    handleDecline,
  };
}
