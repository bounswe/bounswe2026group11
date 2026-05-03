import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  listMyInvitations,
  acceptInvitation,
  declineInvitation,
} from '@/services/invitationService';
import { ReceivedInvitation } from '@/models/invitation';
import { ApiError } from '@/services/api';

export interface InvitationsViewModel {
  invitations: ReceivedInvitation[];
  isLoading: boolean;
  isActionLoading: string | null; // Stores invitation_id of the currently acting invitation
  error: string | null;
  fetchInvitations: () => Promise<void>;
  handleAccept: (invitationId: string) => Promise<void>;
  handleDecline: (invitationId: string) => Promise<void>;
}

export function useInvitationsViewModel(): InvitationsViewModel {
  const { token } = useAuth();
  const [invitations, setInvitations] = useState<ReceivedInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await listMyInvitations(token);
      setInvitations(response.items);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load invitations');
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
        // Remove from list upon success
        setInvitations((prev) => prev.filter((i) => i.invitation_id !== invitationId));
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to accept invitation');
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
        // Remove from list upon success
        setInvitations((prev) => prev.filter((i) => i.invitation_id !== invitationId));
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to decline invitation');
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
