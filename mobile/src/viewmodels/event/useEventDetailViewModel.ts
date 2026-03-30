import { useCallback, useEffect, useMemo, useState } from 'react';
import { EventDetail, ParticipationStatus } from '@/models/event';
import {
  getEventDetail,
  joinEvent,
  requestJoinEvent,
} from '@/services/eventService';
import { useAuth } from '@/contexts/AuthContext';

export type ActionState =
  | 'idle'
  | 'joining'
  | 'requesting'
  | 'saving'
  | 'success_joined'
  | 'success_requested'
  | 'success_saved';

export interface EventDetailViewModel {
  event: EventDetail | null;
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

  handleJoin: () => Promise<void>;
  handleRequestJoin: () => Promise<void>;
  handleToggleFavorite: () => void;
  retry: () => void;
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
  const { token, user } = useAuth();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>('idle');

  const [isFavorited, setIsFavorited] = useState(false);
  const [participationStatus, setParticipationStatus] =
    useState<ParticipationStatus | null>(null);

  const [showJoinRequestModal, setShowJoinRequestModal] = useState(false);
  const [joinRequestMessage, setJoinRequestMessage] = useState('');

  const isQuotaFull =
    event?.capacity != null &&
    event.approved_participant_count >= event.capacity;

  const constraintViolation = useMemo(
    () =>
      event != null
        ? resolveConstraintViolation(event, user?.gender, user?.birth_date)
        : null,
    [event, user?.gender, user?.birth_date],
  );

  const fetchEvent = useCallback(async (silent = false) => {
    if (!token) {
      setApiError('You must be logged in to view this event.');
      if (!silent) setIsLoading(false);
      return;
    }

    if (!silent) setIsLoading(true);
    setApiError(null);

    try {
      const data = await getEventDetail(eventId, token);
      setEvent(data);
      setIsFavorited(data.viewer_context.is_favorited);
      setParticipationStatus(data.viewer_context.participation_status);
    } catch {
      if (!silent) setApiError('Failed to load event details. Please try again.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [eventId, token]);

  useEffect(() => {
    void fetchEvent();
  }, [fetchEvent]);

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

  const handleToggleFavorite = useCallback(() => {
    // TODO: wire to POST /events/{id}/favorite when backend endpoint is available
    setIsFavorited((prev) => !prev);
  }, []);

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

  return {
    event,
    isLoading,
    apiError,
    actionError,
    actionState,
    isFavorited,
    participationStatus,
    isQuotaFull,
    constraintViolation,
    showJoinRequestModal,
    joinRequestMessage,
    openJoinRequestModal,
    closeJoinRequestModal,
    setJoinRequestMessage,
    handleJoin,
    handleRequestJoin,
    handleToggleFavorite,
    retry,
  };
}
