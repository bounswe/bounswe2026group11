import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EventDetail,
  EventDetailApprovedParticipant,
  EventDetailPendingJoinRequest,
  EventHostContextSummary,
  ParticipationStatus,
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
} from '@/services/eventService';
import { addFavorite, removeFavorite } from '@/services/favoriteService';
import { useAuth } from '@/contexts/AuthContext';

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

  showJoinRequestModal: boolean;
  joinRequestMessage: string;

  openJoinRequestModal: () => void;
  closeJoinRequestModal: () => void;
  setJoinRequestMessage: (message: string) => void;

  canLeave: boolean;
  handleJoin: () => Promise<void>;
  handleLeaveEvent: () => Promise<void>;
  handleRequestJoin: () => Promise<void>;
  handleToggleFavorite: () => Promise<void>;
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

  const [isFavorited, setIsFavorited] = useState(false);
  const [participationStatus, setParticipationStatus] =
    useState<ParticipationStatus | null>(null);

  const [showJoinRequestModal, setShowJoinRequestModal] = useState(false);
  const [joinRequestMessage, setJoinRequestMessage] = useState('');

  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);

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
  }, []);

  const refreshHostContextSummary = useCallback(async () => {
    if (!token) return null;
    const summary = await getEventHostContextSummary(eventId, token);
    setHostContextSummary(summary);
    return summary;
  }, [eventId, token]);

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

  const fetchEvent = useCallback(async (silent = false) => {
    if (!token) {
      setApiError('You must be logged in to view this event.');
      if (!silent) setIsLoading(false);
      return;
    }

    if (!silent) setIsLoading(true);
    setApiError(null);
    resetHostManagement();

    try {
      const data = await getEventDetail(eventId, token);
      setEvent(data);
      setIsFavorited(data.viewer_context.is_favorited);
      setParticipationStatus(data.viewer_context.participation_status);
      if (data.viewer_context.is_host) {
        void refreshHostContextSummary();
      }
    } catch {
      if (!silent) setApiError('Failed to load event details. Please try again.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [eventId, token, resetHostManagement, refreshHostContextSummary]);

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
    retry,
    showRequestsModal,
    setShowRequestsModal,
    showAttendeesModal,
    setShowAttendeesModal,
    loadMoreApprovedParticipants,
    loadMorePendingJoinRequests,
    handleApproveRequest,
    handleRejectRequest,
    handleCancelEvent,
  };
}
