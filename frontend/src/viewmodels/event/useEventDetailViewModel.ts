import { useState, useEffect, useCallback } from 'react';
import {
  getEventDetail,
  joinEvent,
  requestJoinEvent,
  approveJoinRequest,
  rejectJoinRequest,
  cancelEvent,
  upsertEventRating,
  upsertParticipantRating,
} from '@/services/eventService';
import type { EventDetailResponse } from '@/models/event';
import { ApiError } from '@/services/api';

export type DetailStatus = 'loading' | 'ready' | 'not-found' | 'forbidden' | 'error';

export function useEventDetailViewModel(eventId: string | undefined, token: string | null) {
  const [event, setEvent] = useState<EventDetailResponse | null>(null);
  const [status, setStatus] = useState<DetailStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [viewerRatingLoading, setViewerRatingLoading] = useState(false);
  const [viewerRatingError, setViewerRatingError] = useState<string | null>(null);
  const [participantRatingLoadingId, setParticipantRatingLoadingId] = useState<string | null>(null);
  const [participantRatingError, setParticipantRatingError] = useState<{
    participantUserId: string;
    message: string;
  } | null>(null);

  const refreshEventDetail = useCallback(async () => {
    if (!eventId) {
      return null;
    }

    const data = await getEventDetail(eventId, token);
    setEvent(data);
    return data;
  }, [eventId, token]);

  const fetchDetail = useCallback(async () => {
    if (!eventId) {
      setStatus('error');
      setErrorMessage('Invalid event ID.');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const data = await refreshEventDetail();
      if (!data) {
        throw new Error('Event detail is unavailable.');
      }
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
  }, [eventId, token, refreshEventDetail]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleJoin = useCallback(async () => {
    if (!eventId || !token) return;
    setJoinLoading(true);
    setJoinError(null);

    try {
      await joinEvent(eventId, token);
      await refreshEventDetail();
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
  }, [eventId, token, refreshEventDetail]);

  const handleRequestJoin = useCallback(async (message?: string) => {
    if (!eventId || !token) return;
    setJoinLoading(true);
    setJoinError(null);

    try {
      await requestJoinEvent(eventId, token, message);
      await refreshEventDetail();
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
  }, [eventId, token, refreshEventDetail]);

  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [moderateError, setModerateError] = useState<string | null>(null);

  const handleApprove = useCallback(async (joinRequestId: string) => {
    if (!eventId || !token) return;
    setModeratingId(joinRequestId);
    setModerateError(null);

    try {
      await approveJoinRequest(eventId, joinRequestId, token);
      await refreshEventDetail();
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
  }, [eventId, token, refreshEventDetail]);

  const handleReject = useCallback(async (joinRequestId: string) => {
    if (!eventId || !token) return;
    setModeratingId(joinRequestId);
    setModerateError(null);

    try {
      await rejectJoinRequest(eventId, joinRequestId, token);
      await refreshEventDetail();
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
  }, [eventId, token, refreshEventDetail]);

  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancel = useCallback(async () => {
    if (!eventId || !token) return;
    setCancelLoading(true);
    setCancelError(null);

    try {
      await cancelEvent(eventId, token);
      await refreshEventDetail();
    } catch (err) {
      if (err instanceof ApiError) {
        const errorMap: Record<string, string> = {
          event_cancel_not_allowed: 'Only the event host can cancel this event.',
          event_not_cancelable: 'Only active events can be canceled.',
        };
        setCancelError(errorMap[err.code] ?? err.message);
      } else {
        setCancelError('Failed to cancel event. Please try again.');
      }
    } finally {
      setCancelLoading(false);
    }
  }, [eventId, token, refreshEventDetail]);

  const mapRatingError = useCallback((err: ApiError, fallback: string) => {
    const errorMap: Record<string, string> = {
      rating_not_allowed: 'You are not allowed to submit a rating for this event.',
      rating_window_closed: 'The 7-day rating window has already closed.',
      host_cannot_rate_self: 'Hosts cannot rate themselves.',
      validation_error: err.details?.message ?? fallback,
    };

    if (err.code === 'validation_error') {
      const ratingMessage = err.details?.rating;
      const feedbackMessage = err.details?.message;
      return feedbackMessage ?? ratingMessage ?? err.message;
    }

    return errorMap[err.code] ?? err.message ?? fallback;
  }, []);

  const handleViewerRatingSubmit = useCallback(async (rating: number, message?: string) => {
    if (!eventId || !token) return;
    setViewerRatingLoading(true);
    setViewerRatingError(null);

    try {
      await upsertEventRating(eventId, { rating, message: message?.trim() || null }, token);
      await refreshEventDetail();
    } catch (err) {
      if (err instanceof ApiError) {
        setViewerRatingError(mapRatingError(err, 'Failed to save your rating. Please try again.'));
      } else {
        setViewerRatingError('Failed to save your rating. Please try again.');
      }
    } finally {
      setViewerRatingLoading(false);
    }
  }, [eventId, token, refreshEventDetail, mapRatingError]);

  const handleParticipantRatingSubmit = useCallback(async (
    participantUserId: string,
    rating: number,
    message?: string,
  ) => {
    if (!eventId || !token) return;
    setParticipantRatingLoadingId(participantUserId);
    setParticipantRatingError(null);

    try {
      await upsertParticipantRating(
        eventId,
        participantUserId,
        { rating, message: message?.trim() || null },
        token,
      );
      await refreshEventDetail();
    } catch (err) {
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
  }, [eventId, token, refreshEventDetail, mapRatingError]);

  const dismissJoinError = useCallback(() => setJoinError(null), []);
  const dismissModerateError = useCallback(() => setModerateError(null), []);
  const dismissCancelError = useCallback(() => setCancelError(null), []);
  const dismissViewerRatingError = useCallback(() => setViewerRatingError(null), []);
  const dismissParticipantRatingError = useCallback(() => setParticipantRatingError(null), []);

  return {
    event,
    status,
    errorMessage,
    joinLoading,
    joinError,
    viewerRatingLoading,
    viewerRatingError,
    participantRatingLoadingId,
    participantRatingError,
    moderatingId,
    moderateError,
    cancelLoading,
    cancelError,
    retry: fetchDetail,
    handleJoin,
    handleRequestJoin,
    handleViewerRatingSubmit,
    handleParticipantRatingSubmit,
    handleApprove,
    handleReject,
    handleCancel,
    dismissJoinError,
    dismissViewerRatingError,
    dismissParticipantRatingError,
    dismissModerateError,
    dismissCancelError,
  };
}
