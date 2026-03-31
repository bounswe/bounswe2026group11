import { useState, useEffect, useCallback } from 'react';
import { getEventDetail, joinEvent, requestJoinEvent, approveJoinRequest, rejectJoinRequest } from '@/services/eventService';
import type { EventDetailResponse } from '@/models/event';
import { ApiError } from '@/services/api';

export type DetailStatus = 'loading' | 'ready' | 'not-found' | 'forbidden' | 'error';

export function useEventDetailViewModel(eventId: string | undefined, token: string | null) {
  const [event, setEvent] = useState<EventDetailResponse | null>(null);
  const [status, setStatus] = useState<DetailStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!eventId || !token) {
      setStatus('error');
      setErrorMessage(!token ? 'You must be signed in to view this event.' : 'Invalid event ID.');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const data = await getEventDetail(eventId, token);
      setEvent(data);
      setStatus('ready');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setStatus('not-found');
        } else if (err.status === 403) {
          setStatus('forbidden');
        } else {
          setStatus('error');
          setErrorMessage(err.message);
        }
      } else {
        setStatus('error');
        setErrorMessage('Failed to load event. Please try again.');
      }
    }
  }, [eventId, token]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleJoin = useCallback(async () => {
    if (!eventId || !token || !event) return;
    setJoinLoading(true);
    setJoinError(null);

    try {
      await joinEvent(eventId, token);
      // Re-fetch to get updated participant count and viewer context
      const updated = await getEventDetail(eventId, token);
      setEvent(updated);
    } catch (err) {
      if (err instanceof ApiError) {
        const errorMap: Record<string, string> = {
          already_participating: 'You are already participating in this event.',
          capacity_exceeded: 'This event is full.',
          event_join_not_allowed: 'This event does not allow direct joining.',
          host_cannot_join: 'You cannot join your own event.',
        };
        setJoinError(errorMap[err.code] ?? err.message);
      } else {
        setJoinError('Failed to join event. Please try again.');
      }
    } finally {
      setJoinLoading(false);
    }
  }, [eventId, token, event]);

  const handleRequestJoin = useCallback(async (message?: string) => {
    if (!eventId || !token || !event) return;
    setJoinLoading(true);
    setJoinError(null);

    try {
      await requestJoinEvent(eventId, token, message);
      // Re-fetch to get updated viewer context
      const updated = await getEventDetail(eventId, token);
      setEvent(updated);
    } catch (err) {
      if (err instanceof ApiError) {
        const errorMap: Record<string, string> = {
          already_participating: 'You are already participating in this event.',
          already_requested: 'You already have a pending request for this event.',
          event_join_not_allowed: 'This event does not accept join requests.',
          host_cannot_join: 'You cannot request to join your own event.',
          join_request_cooldown_active: 'You must wait before requesting again.',
        };
        setJoinError(errorMap[err.code] ?? err.message);
      } else {
        setJoinError('Failed to send join request. Please try again.');
      }
    } finally {
      setJoinLoading(false);
    }
  }, [eventId, token, event]);

  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [moderateError, setModerateError] = useState<string | null>(null);

  const handleApprove = useCallback(async (joinRequestId: string) => {
    if (!eventId || !token) return;
    setModeratingId(joinRequestId);
    setModerateError(null);

    try {
      await approveJoinRequest(eventId, joinRequestId, token);
      const updated = await getEventDetail(eventId, token);
      setEvent(updated);
    } catch (err) {
      if (err instanceof ApiError) {
        const errorMap: Record<string, string> = {
          join_request_state_invalid: 'This request is no longer pending.',
          capacity_exceeded: 'Cannot approve — event is full.',
          already_participating: 'This user is already participating.',
          join_request_moderation_not_allowed: 'Only the host can moderate requests.',
        };
        setModerateError(errorMap[err.code] ?? err.message);
      } else {
        setModerateError('Failed to approve request. Please try again.');
      }
    } finally {
      setModeratingId(null);
    }
  }, [eventId, token]);

  const handleReject = useCallback(async (joinRequestId: string) => {
    if (!eventId || !token) return;
    setModeratingId(joinRequestId);
    setModerateError(null);

    try {
      await rejectJoinRequest(eventId, joinRequestId, token);
      const updated = await getEventDetail(eventId, token);
      setEvent(updated);
    } catch (err) {
      if (err instanceof ApiError) {
        const errorMap: Record<string, string> = {
          join_request_state_invalid: 'This request is no longer pending.',
          join_request_moderation_not_allowed: 'Only the host can moderate requests.',
        };
        setModerateError(errorMap[err.code] ?? err.message);
      } else {
        setModerateError('Failed to reject request. Please try again.');
      }
    } finally {
      setModeratingId(null);
    }
  }, [eventId, token]);

  const dismissJoinError = useCallback(() => setJoinError(null), []);
  const dismissModerateError = useCallback(() => setModerateError(null), []);

  return {
    event,
    status,
    errorMessage,
    joinLoading,
    joinError,
    moderatingId,
    moderateError,
    retry: fetchDetail,
    handleJoin,
    handleRequestJoin,
    handleApprove,
    handleReject,
    dismissJoinError,
    dismissModerateError,
  };
}
