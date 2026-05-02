import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  EventDetail,
  EventDetailApprovedParticipant,
  EventDetailPendingJoinRequest,
  EventHostContextSummary,
  ParticipationStatus,
  EventDetailInvitation,
} from '@/models/event';
import {
  getEventDetail,
  getEventHostContextSummary,
  joinEvent,
  leaveEvent,
  requestJoinEvent,
  listEventApprovedParticipants,
  listEventPendingJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  cancelEvent,
  upsertEventRating,
  upsertParticipantRating,
  listEventInvitations,
  createEventInvitations,
} from '@/services/eventService';
import { addFavorite, removeFavorite } from '@/services/favoriteService';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/services/api';
import { searchUsers } from '@/services/profileService';

export type ActionState =
  | 'idle'
  | 'joining'
  | 'leaving'
  | 'requesting'
  | 'saving'
  | 'success_joined'
  | 'success_left'
  | 'success_requested'
  | 'success_saved';

export interface EventDetailViewModel {
  event: EventDetail | null;
  hostContextSummary: EventHostContextSummary | null;
  approvedParticipants: EventDetailApprovedParticipant[];
  pendingJoinRequests: EventDetailPendingJoinRequest[];
  approvedParticipantsLoading: boolean;
  pendingJoinRequestsLoading: boolean;
  approvedParticipantsHasNext: boolean;
  pendingJoinRequestsHasNext: boolean;
  isLoading: boolean;
  apiError: string | null;
  actionError: string | null;
  actionState: ActionState;
  isFavorited: boolean;
  participationStatus: ParticipationStatus | null;
  isQuotaFull: boolean;
  constraintViolation: string | null;
  viewerRatingLoading: boolean;
  viewerRatingError: string | null;
  participantRatingLoadingId: string | null;
  participantRatingError: { participantUserId: string; message: string } | null;

  showJoinRequestModal: boolean;
  joinRequestMessage: string;

  openJoinRequestModal: () => void;
  closeJoinRequestModal: () => void;
  setJoinRequestMessage: (message: string) => void;

  userSearchQuery: string;
  setUserSearchQuery: (query: string) => void;
  userSuggestions: any[];
  isSearchingUsers: boolean;

  showInvitationsModal: boolean;
  setShowInvitationsModal: (val: boolean) => void;
  invitations: EventDetailInvitation[];
  invitationsLoading: boolean;
  invitationsHasNext: boolean;
  loadMoreInvitations: () => Promise<void>;
  handleInviteUsers: (usernames: string[]) => Promise<void>;
  isInviting: boolean;

  canLeave: boolean;
  handleJoin: () => Promise<void>;
  handleLeaveEvent: () => Promise<void>;
  handleRequestJoin: () => Promise<void>;
  handleToggleFavorite: () => Promise<void>;
  handleViewerRatingSubmit: (rating: number, message?: string) => Promise<void>;
  handleParticipantRatingSubmit: (participantUserId: string, rating: number, message?: string) => Promise<void>;
  dismissViewerRatingError: () => void;
  dismissParticipantRatingError: () => void;
  retry: () => void;

  showRequestsModal: boolean;
  setShowRequestsModal: (val: boolean) => void;
  showAttendeesModal: boolean;
  setShowAttendeesModal: (val: boolean) => void;
  loadMoreApprovedParticipants: () => Promise<void>;
  loadMorePendingJoinRequests: () => Promise<void>;
  handleApproveRequest: (joinRequestId: string) => Promise<void>;
  handleRejectRequest: (joinRequestId: string) => Promise<void>;
  handleCancelEvent: () => Promise<void>;
}

function mapRatingError(err: ApiError, fallback: string): string {
  const errorMap: Record<string, string> = {
    rating_not_allowed: 'You are not allowed to submit a rating for this event.',
    rating_window_closed: 'The 7-day rating window has already closed.',
    host_cannot_rate_self: 'Hosts cannot rate themselves.',
  };

  if (err.code === 'validation_error') {
    const ratingMessage = err.details?.rating;
    const feedbackMessage = err.details?.message;
    return feedbackMessage ?? ratingMessage ?? err.message;
  }

  return errorMap[err.code] ?? err.message ?? fallback;
}

function computeAgeFromBirthDate(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}


export function resolveConstraintViolation(
  event: EventDetail,
  userGender?: string | null,
  userBirthDate?: string | null,
): string | null {
  const violations: string[] = [];

  const genderTrim = userGender?.trim() ?? '';
  if (
    event.preferred_gender != null &&
    genderTrim !== '' &&
    genderTrim.toUpperCase() !== event.preferred_gender
  ) {
    const label =
      event.preferred_gender.charAt(0) + event.preferred_gender.slice(1).toLowerCase();
    violations.push(`This event is open to ${label} participants only`);
  }

  const birthTrim = userBirthDate?.trim() ?? '';
  if (event.minimum_age != null && birthTrim !== '') {
    const age = computeAgeFromBirthDate(birthTrim);
    if (age < event.minimum_age) {
      violations.push(`Participants must be ${event.minimum_age}+ years old`);
    }
  }

  return violations.length > 0 ? violations.join(' · ') : null;
}

export function useEventDetailViewModel(eventId: string): EventDetailViewModel {
  const hostCollectionPageSize = 25;
  const { token, user } = useAuth();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [hostContextSummary, setHostContextSummary] = useState<EventHostContextSummary | null>(null);
  const [approvedParticipants, setApprovedParticipants] = useState<EventDetailApprovedParticipant[]>([]);
  const [approvedParticipantsLoading, setApprovedParticipantsLoading] = useState(false);
  const [approvedParticipantsNextCursor, setApprovedParticipantsNextCursor] = useState<string | null>(null);
  const [approvedParticipantsHasNext, setApprovedParticipantsHasNext] = useState(false);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<EventDetailPendingJoinRequest[]>([]);
  const [pendingJoinRequestsLoading, setPendingJoinRequestsLoading] = useState(false);
  const [pendingJoinRequestsNextCursor, setPendingJoinRequestsNextCursor] = useState<string | null>(null);
  const [pendingJoinRequestsHasNext, setPendingJoinRequestsHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [viewerRatingLoading, setViewerRatingLoading] = useState(false);
  const [viewerRatingError, setViewerRatingError] = useState<string | null>(null);
  const [participantRatingLoadingId, setParticipantRatingLoadingId] = useState<string | null>(null);
  const [participantRatingError, setParticipantRatingError] = useState<{ participantUserId: string; message: string } | null>(null);

  const [isFavorited, setIsFavorited] = useState(false);
  const [participationStatus, setParticipationStatus] =
    useState<ParticipationStatus | null>(null);

  const [showJoinRequestModal, setShowJoinRequestModal] = useState(false);
  const [joinRequestMessage, setJoinRequestMessage] = useState('');

  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);
  const [showInvitationsModal, setShowInvitationsModal] = useState(false);
  const [invitations, setInvitations] = useState<EventDetailInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [invitationsCursor, setInvitationsCursor] = useState<string | null>(null);
  const [invitationsHasNext, setInvitationsHasNext] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSuggestions, setUserSuggestions] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const userSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isQuotaFull =
    event?.capacity != null &&
    event.approved_participant_count >= event.capacity;

  const canLeave = useMemo(() => {
    if (!event) return false;
    if (event.viewer_context.is_host) return false;
    if (participationStatus !== 'JOINED') return false;
    if (event.status === 'CANCELED' || event.status === 'COMPLETED') return false;
    if (event.end_time) {
      const now = new Date();
      const endTime = new Date(event.end_time);
      if (now >= endTime) return false;
    }
    return true;
  }, [event, participationStatus]);

  const constraintViolation = useMemo(
    () =>
      event != null
        ? resolveConstraintViolation(event, user?.gender, user?.birth_date)
        : null,
    [event, user?.gender, user?.birth_date],
  );

  const resetHostManagement = useCallback(() => {
    setHostContextSummary(null);
    setApprovedParticipants([]);
    setApprovedParticipantsNextCursor(null);
    setApprovedParticipantsHasNext(false);
    setPendingJoinRequests([]);
    setPendingJoinRequestsNextCursor(null);
    setPendingJoinRequestsHasNext(false);
    setInvitations([]);
    setInvitationsCursor(null);
    setInvitationsHasNext(false);
  }, []);

  const refreshHostContextSummary = useCallback(async () => {
    if (!token) return null;
    const summary = await getEventHostContextSummary(eventId, token);
    setHostContextSummary(summary);
    return summary;
  }, [eventId, token]);

  const fetchEvent = useCallback(
    async (silent = false) => {
      if (!token) {
        setApiError('You must be logged in to view this event.');
        if (!silent) setIsLoading(false);
        return;
      }

      if (!silent) setIsLoading(true);
      setApiError(null);
      if (!silent) resetHostManagement();

      try {
        const data = await getEventDetail(eventId, token);
        setEvent(data);
        setIsFavorited(data.viewer_context.is_favorited);
        setParticipationStatus(data.viewer_context.participation_status);
        if (data.viewer_context.is_host) {
          void refreshHostContextSummary();
        }
      } catch (err) {
        if (!silent) {
          if (err instanceof ApiError && err.status === 404) {
            setApiError(
              'This event is either private or does not exist. You may need an invitation to view it.',
            );
          } else {
            setApiError('Failed to load event details. Please try again.');
          }
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [eventId, token, resetHostManagement, refreshHostContextSummary],
  );

  const refreshApprovedParticipants = useCallback(async (cursor?: string | null, append = false) => {
    if (!token) return;
    setApprovedParticipantsLoading(true);
    try {
      const response = await listEventApprovedParticipants(eventId, token, {
        limit: hostCollectionPageSize,
        cursor,
      });
      setApprovedParticipants((prev) => append ? [...prev, ...response.items] : response.items);
      setApprovedParticipantsNextCursor(response.page_info.next_cursor ?? null);
      setApprovedParticipantsHasNext(response.page_info.has_next);
    } finally {
      setApprovedParticipantsLoading(false);
    }
  }, [eventId, token]);

  const refreshPendingJoinRequests = useCallback(async (cursor?: string | null, append = false) => {
    if (!token) return;
    setPendingJoinRequestsLoading(true);
    try {
      const response = await listEventPendingJoinRequests(eventId, token, {
        limit: hostCollectionPageSize,
        cursor,
      });
      setPendingJoinRequests((prev) => append ? [...prev, ...response.items] : response.items);
      setPendingJoinRequestsNextCursor(response.page_info.next_cursor ?? null);
      setPendingJoinRequestsHasNext(response.page_info.has_next);
    } finally {
      setPendingJoinRequestsLoading(false);
    }
  }, [eventId, token]);

  const loadMoreInvitations = useCallback(async () => {
    if (!token || invitationsLoading || (!invitationsCursor && invitations.length > 0)) return;

    setInvitationsLoading(true);
    try {
      if (!invitationsCursor) void fetchEvent(true);
      const resp = await listEventInvitations(eventId, token, {
        cursor: invitationsCursor,
        limit: 15,
      });
      setInvitations((prev) => (invitationsCursor ? [...prev, ...resp.items] : resp.items));
      setInvitationsCursor(resp.page_info.next_cursor ?? null);
      setInvitationsHasNext(resp.page_info.has_next);
    } catch (err) {
      console.error('Failed to load invitations', err);
    } finally {
      setInvitationsLoading(false);
    }
  }, [eventId, token, invitationsCursor, fetchEvent]);

  const handleInviteUsers = useCallback(
    async (usernames: string[], message?: string) => {
      if (!token || isInviting || usernames.length === 0) return;

      if (user?.username && usernames.includes(user.username)) {
        throw new Error('You cannot invite yourself to your own event.');
      }

      setIsInviting(true);
      setActionError(null);
      try {
        const resp = await createEventInvitations(eventId, usernames, token, message);
        
        // Check for partial failures returned by the backend
        const invalidUsernames = resp.invalid_usernames || [];
        const cooldownUsernames = (resp.failed || [])
          .filter((f: any) => f.code === 'DECLINE_COOLDOWN_ACTIVE')
          .map((f: any) => f.username);
        const otherFailedUsernames = (resp.failed || [])
          .filter((f: any) => f.code !== 'DECLINE_COOLDOWN_ACTIVE')
          .map((f: any) => f.username);

        if (invalidUsernames.length > 0 || cooldownUsernames.length > 0 || otherFailedUsernames.length > 0) {
          let errorMessage = '';
          if (invalidUsernames.length > 0) {
            errorMessage += `User(s) not found: ${invalidUsernames.join(', ')}. `;
          }
          if (cooldownUsernames.length > 0) {
            errorMessage += `Recently declined: ${cooldownUsernames.join(', ')} (wait 14 days). `;
          }
          if (otherFailedUsernames.length > 0) {
            errorMessage += `Already invited or participating: ${otherFailedUsernames.join(', ')}.`;
          }
          throw new Error(errorMessage.trim());
        }

        void refreshHostContextSummary();
        void fetchEvent(true);
        setInvitations([]);
        setInvitationsCursor(null);
        setInvitationsHasNext(false);
        void loadMoreInvitations();
      } catch (err) {
        let msg = 'Failed to send invitations';
        if (err instanceof ApiError) {
          msg = err.message;
          if (err.code === 'validation_error' && err.details) {
            const firstDetail = Object.values(err.details)[0];
            if (firstDetail) msg = String(firstDetail);
          }
        } else if (err instanceof Error) {
          msg = err.message;
        }
        // Do NOT setActionError(msg) here to keep it inside the modal
        throw new Error(msg);
      } finally {
        setIsInviting(false);
      }
    },
    [eventId, token, isInviting, refreshHostContextSummary],
  );

  useEffect(() => {
    if (!token || userSearchQuery.length < 2) {
      setUserSuggestions([]);
      return;
    }

    if (userSearchTimeoutRef.current) {
      clearTimeout(userSearchTimeoutRef.current);
    }

    userSearchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const resp = await searchUsers(userSearchQuery, token);
        const filtered = (resp.items || []).filter((u: any) => u.username !== user?.username);
        setUserSuggestions(filtered || []);
      } catch (err) {
        console.error('User search failed', err);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 300);

    return () => {
      if (userSearchTimeoutRef.current) clearTimeout(userSearchTimeoutRef.current);
    };
  }, [userSearchQuery, token]);

  // Note: fetchEvent moved up to fix hoisting issues with invitations logic

  useEffect(() => {
    void fetchEvent();
  }, [fetchEvent]);

  useEffect(() => {
    if (!showAttendeesModal || !event?.viewer_context.is_host || approvedParticipants.length > 0) return;
    void refreshApprovedParticipants();
  }, [approvedParticipants.length, event?.viewer_context.is_host, refreshApprovedParticipants, showAttendeesModal]);

  useEffect(() => {
    if (!showRequestsModal || !event?.viewer_context.is_host || pendingJoinRequests.length > 0) return;
    void refreshPendingJoinRequests();
  }, [event?.viewer_context.is_host, pendingJoinRequests.length, refreshPendingJoinRequests, showRequestsModal]);

  useEffect(() => {
    if (showInvitationsModal && invitations.length === 0) {
      void loadMoreInvitations();
    }
  }, [showInvitationsModal, invitations.length, loadMoreInvitations]);

  const handleJoin = useCallback(async () => {
    if (!token || !event) return;

    setActionError(null);
    setActionState('joining');

    try {
      await joinEvent(event.id, token);
      setActionState('success_joined');
      await fetchEvent(true);
    } catch (err: unknown) {
      setActionState('idle');
      if (err && typeof err === 'object' && 'message' in err) {
        setActionError((err as { message: string }).message);
      } else {
        setActionError('Failed to join the event. Please try again.');
      }
    }
  }, [token, event, fetchEvent]);

  const handleLeaveEvent = useCallback(async () => {
    if (!token || !event) return;

    setActionError(null);
    setActionState('leaving');

    try {
      const leftBeforeStart = new Date() < new Date(event.start_time);
      await leaveEvent(event.id, token);
      setParticipationStatus('LEAVED');
      await fetchEvent(true);
      // Pre-start leave: backend resets participation, so go back to idle
      // to let the join/request button render based on refreshed status.
      // Post-start leave: show the "You left" chip.
      setActionState(leftBeforeStart ? 'idle' : 'success_left');
    } catch (err: unknown) {
      setActionState('idle');
      if (err && typeof err === 'object' && 'message' in err) {
        setActionError((err as { message: string }).message);
      } else {
        setActionError('Failed to leave the event. Please try again.');
      }
    }
  }, [token, event, fetchEvent]);

  const handleRequestJoin = useCallback(async () => {
    if (!token || !event) return;

    setActionError(null);
    setActionState('requesting');

    try {
      await requestJoinEvent(
        event.id,
        { message: joinRequestMessage.trim() || null },
        token,
      );
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              viewer_context: {
                ...prev.viewer_context,
                participation_status: 'PENDING',
              },
            }
          : prev,
      );
      setParticipationStatus('PENDING');
      setActionState('success_requested');
      setShowJoinRequestModal(false);
      setJoinRequestMessage('');
    } catch (err: unknown) {
      setActionState('idle');
      if (err && typeof err === 'object' && 'message' in err) {
        setActionError((err as { message: string }).message);
      } else {
        setActionError('Failed to send join request. Please try again.');
      }
    }
  }, [token, event, joinRequestMessage]);

  const handleToggleFavorite = useCallback(async () => {
    if (!token || !event) return;

    const wasFavorited = isFavorited;
    const previousCount = event.favorite_count;
    const nextCount = wasFavorited
      ? Math.max(0, previousCount - 1)
      : previousCount + 1;

    setIsFavorited(!wasFavorited);
    setEvent((prev) =>
      prev ? { ...prev, favorite_count: nextCount } : prev,
    );

    try {
      if (wasFavorited) {
        await removeFavorite(event.id, token);
      } else {
        await addFavorite(event.id, token);
      }
    } catch {
      setIsFavorited(wasFavorited);
      setEvent((prev) =>
        prev ? { ...prev, favorite_count: previousCount } : prev,
      );
      setActionError('Failed to update favorite. Please try again.');
    }
  }, [token, event, isFavorited]);

  const handleViewerRatingSubmit = useCallback(async (rating: number, message?: string) => {
    if (!token || !event) return;

    setViewerRatingLoading(true);
    setViewerRatingError(null);

    try {
      await upsertEventRating(event.id, { rating, message: message?.trim() || null }, token);
      await fetchEvent(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setViewerRatingError(mapRatingError(err, 'Failed to save your rating. Please try again.'));
      } else {
        setViewerRatingError('Failed to save your rating. Please try again.');
      }
    } finally {
      setViewerRatingLoading(false);
    }
  }, [token, event, fetchEvent]);

  const handleParticipantRatingSubmit = useCallback(async (
    participantUserId: string,
    rating: number,
    message?: string,
  ) => {
    if (!token || !event) return;

    setParticipantRatingLoadingId(participantUserId);
    setParticipantRatingError(null);

    try {
      await upsertParticipantRating(
        event.id,
        participantUserId,
        { rating, message: message?.trim() || null },
        token,
      );
      await Promise.all([fetchEvent(true), refreshApprovedParticipants(undefined, false)]);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setParticipantRatingError({
          participantUserId,
          message: mapRatingError(err, 'Failed to save the participant rating. Please try again.'),
        });
      } else {
        setParticipantRatingError({
          participantUserId,
          message: 'Failed to save the participant rating. Please try again.',
        });
      }
    } finally {
      setParticipantRatingLoadingId(null);
    }
  }, [token, event, fetchEvent, refreshApprovedParticipants]);

  const handleApproveRequest = useCallback(
    async (joinRequestId: string) => {
      if (!token || !event) return;
      try {
        await approveJoinRequest(event.id, joinRequestId, token);
        await Promise.all([
          fetchEvent(true),
          refreshHostContextSummary(),
          refreshApprovedParticipants(undefined, false),
          refreshPendingJoinRequests(undefined, false),
        ]);
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'message' in err) {
          setActionError((err as { message: string }).message);
        } else {
          setActionError('Failed to approve request.');
        }
      }
    },
    [token, event, fetchEvent, refreshApprovedParticipants, refreshHostContextSummary, refreshPendingJoinRequests],
  );

  const handleRejectRequest = useCallback(
    async (joinRequestId: string) => {
      if (!token || !event) return;
      try {
        await rejectJoinRequest(event.id, joinRequestId, token);
        await Promise.all([
          fetchEvent(true),
          refreshHostContextSummary(),
          refreshPendingJoinRequests(undefined, false),
        ]);
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'message' in err) {
          setActionError((err as { message: string }).message);
        } else {
          setActionError('Failed to reject request.');
        }
      }
    },
    [token, event, fetchEvent, refreshHostContextSummary, refreshPendingJoinRequests],
  );

  const handleCancelEvent = useCallback(async () => {
    if (!token || !event) return;
    try {
      await cancelEvent(event.id, token);
      await fetchEvent(true);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err) {
        setActionError((err as { message: string }).message);
      } else {
        setActionError('Failed to cancel event.');
      }
    }
  }, [token, event, fetchEvent]);

  const openJoinRequestModal = useCallback(() => {
    setActionError(null);
    setShowJoinRequestModal(true);
  }, []);

  const closeJoinRequestModal = useCallback(() => {
    setShowJoinRequestModal(false);
    setJoinRequestMessage('');
    setActionError(null);
  }, []);

  const retry = useCallback(() => {
    void fetchEvent();
  }, [fetchEvent]);

  const dismissViewerRatingError = useCallback(() => setViewerRatingError(null), []);
  const dismissParticipantRatingError = useCallback(() => setParticipantRatingError(null), []);

  const loadMoreApprovedParticipants = useCallback(async () => {
    if (!approvedParticipantsHasNext || !approvedParticipantsNextCursor || approvedParticipantsLoading) return;
    await refreshApprovedParticipants(approvedParticipantsNextCursor, true);
  }, [
    approvedParticipantsHasNext,
    approvedParticipantsLoading,
    approvedParticipantsNextCursor,
    refreshApprovedParticipants,
  ]);

  const loadMorePendingJoinRequests = useCallback(async () => {
    if (!pendingJoinRequestsHasNext || !pendingJoinRequestsNextCursor || pendingJoinRequestsLoading) return;
    await refreshPendingJoinRequests(pendingJoinRequestsNextCursor, true);
  }, [
    pendingJoinRequestsHasNext,
    pendingJoinRequestsLoading,
    pendingJoinRequestsNextCursor,
    refreshPendingJoinRequests,
  ]);

  return {
    event,
    hostContextSummary,
    approvedParticipants,
    pendingJoinRequests,
    approvedParticipantsLoading,
    pendingJoinRequestsLoading,
    approvedParticipantsHasNext,
    pendingJoinRequestsHasNext,
    isLoading,
    apiError,
    actionError,
    actionState,
    isFavorited,
    participationStatus,
    isQuotaFull,
    viewerRatingLoading,
    viewerRatingError,
    participantRatingLoadingId,
    participantRatingError,
    canLeave,
    constraintViolation,
    showJoinRequestModal,
    joinRequestMessage,
    openJoinRequestModal,
    closeJoinRequestModal,
    setJoinRequestMessage,
    handleJoin,
    handleLeaveEvent,
    handleRequestJoin,
    handleToggleFavorite,
    handleViewerRatingSubmit,
    handleParticipantRatingSubmit,
    dismissViewerRatingError,
    dismissParticipantRatingError,
    retry,
    showRequestsModal,
    setShowRequestsModal,
    showAttendeesModal,
    setShowAttendeesModal,
    showInvitationsModal,
    setShowInvitationsModal,
    invitations,
    invitationsLoading,
    invitationsHasNext,
    loadMoreInvitations,
    handleInviteUsers,
    isInviting,
    userSearchQuery,
    setUserSearchQuery,
    userSuggestions,
    isSearchingUsers,
    loadMoreApprovedParticipants,
    loadMorePendingJoinRequests,
    handleApproveRequest,
    handleRejectRequest,
    handleCancelEvent,
  };
}
