import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  acceptInvitation,
  declineInvitation,
  listMyInvitations,
} from '@/services/invitationService';
import type { ReceivedInvitation } from '@/models/invitation';
import { ApiError } from '@/services/api';

export interface InvitationsViewModel {
  invitations: ReceivedInvitation[];
  isLoading: boolean;
  isActionLoading: string | null;
  error: string | null;
  fetchInvitations: () => Promise<void>;
  handleAccept: (invitationId: string) => Promise<{ event_id: string } | null>;
  handleDecline: (invitationId: string) => Promise<void>;
  dismissError: () => void;
}

function mergeInvitationBuckets(response: Awaited<ReturnType<typeof listMyInvitations>>): ReceivedInvitation[] {
  return [...(response.pending ?? []), ...(response.past?.items ?? [])];
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
      setInvitations(mergeInvitationBuckets(response));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load invitations');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const handleAccept = useCallback(
    async (invitationId: string): Promise<{ event_id: string } | null> => {
      if (!token) return null;
      setIsActionLoading(invitationId);
      setError(null);
      try {
        const response = await acceptInvitation(invitationId, token);
        setInvitations((prev) =>
          prev.map((i) =>
            i.invitation_id === invitationId
              ? { ...i, status: 'ACCEPTED', updated_at: response.updated_at }
              : i,
          ),
        );
        return { event_id: response.event_id };
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to accept invitation');
        return null;
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
      setError(null);
      try {
        const response = await declineInvitation(invitationId, token);
        setInvitations((prev) =>
          prev.map((i) =>
            i.invitation_id === invitationId
              ? { ...i, status: 'DECLINED', updated_at: response.updated_at }
              : i,
          ),
        );
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to decline invitation');
      } finally {
        setIsActionLoading(null);
      }
    },
    [token],
  );

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const dismissError = useCallback(() => setError(null), []);

  return {
    invitations,
    isLoading,
    isActionLoading,
    error,
    fetchInvitations,
    handleAccept,
    handleDecline,
    dismissError,
  };
}
