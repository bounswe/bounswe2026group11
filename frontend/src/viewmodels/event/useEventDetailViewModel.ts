import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getEventDetail,
  getEventHostContextSummary,
  getEventImageUploadUrl,
  confirmEventImageUpload,
  joinEvent,
  requestJoinEvent,
  listEventApprovedParticipants,
  listEventPendingJoinRequests,
  listEventInvitations,
  approveJoinRequest,
  rejectJoinRequest,
  cancelEvent,
  addFavorite,
  removeFavorite,
  upsertEventRating,
  upsertParticipantRating,
  leaveEvent,
} from '@/services/eventService';
import type {
  EventDetailApprovedParticipant,
  EventDetailInvitation,
  EventDetailPendingJoinRequest,
  EventDetailResponse,
  EventHostContextSummary,
} from '@/models/event';
import { ApiError } from '@/services/api';
import { prepareAvatarBlobs } from '@/utils/imageResize';

export type DetailStatus = 'loading' | 'ready' | 'not-found' | 'forbidden' | 'error';

export function useEventDetailViewModel(eventId: string | undefined, token: string | null) {
  const hostCollectionPageSize = 25;
  const [event, setEvent] = useState<EventDetailResponse | null>(null);
  const [status, setStatus] = useState<DetailStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hostContextSummary, setHostContextSummary] = useState<EventHostContextSummary | null>(null);
  const [hostContextLoading, setHostContextLoading] = useState(false);
  const [approvedParticipants, setApprovedParticipants] = useState<EventDetailApprovedParticipant[]>([]);
  const [approvedParticipantsLoading, setApprovedParticipantsLoading] = useState(false);
  const [approvedParticipantsNextCursor, setApprovedParticipantsNextCursor] = useState<string | null>(null);
  const [approvedParticipantsHasNext, setApprovedParticipantsHasNext] = useState(false);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<EventDetailPendingJoinRequest[]>([]);
  const [pendingJoinRequestsLoading, setPendingJoinRequestsLoading] = useState(false);
  const [pendingJoinRequestsNextCursor, setPendingJoinRequestsNextCursor] = useState<string | null>(null);
  const [pendingJoinRequestsHasNext, setPendingJoinRequestsHasNext] = useState(false);
  const [invitations, setInvitations] = useState<EventDetailInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [invitationsNextCursor, setInvitationsNextCursor] = useState<string | null>(null);
  const [invitationsHasNext, setInvitationsHasNext] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [viewerRatingLoading, setViewerRatingLoading] = useState(false);
  const [viewerRatingError, setViewerRatingError] = useState<string | null>(null);
  const [participantRatingLoadingId, setParticipantRatingLoadingId] = useState<string | null>(null);
  const [participantRatingError, setParticipantRatingError] = useState<{
    participantUserId: string;
    message: string;
  } | null>(null);
  const [coverImageUploading, setCoverImageUploading] = useState(false);
  const [coverImageError, setCoverImageError] = useState<string | null>(null);
  const [coverImageSuccessMessage, setCoverImageSuccessMessage] = useState<string | null>(null);
  const coverImageSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (coverImageSuccessTimerRef.current) clearTimeout(coverImageSuccessTimerRef.current);
    },
    [],
  );

  const refreshEventDetail = useCallback(async () => {
    if (!eventId) {
      return null;
    }

    const data = await getEventDetail(eventId, token);
    setEvent(data);
    return data;
  }, [eventId, token]);

  const resetHostManagement = useCallback(() => {
    setHostContextSummary(null);
    setApprovedParticipants([]);
    setApprovedParticipantsNextCursor(null);
    setApprovedParticipantsHasNext(false);
    setPendingJoinRequests([]);
    setPendingJoinRequestsNextCursor(null);
    setPendingJoinRequestsHasNext(false);
    setInvitations([]);
    setInvitationsNextCursor(null);
    setInvitationsHasNext(false);
  }, []);

  const refreshHostContextSummary = useCallback(async () => {
    if (!eventId || !token) return null;
    setHostContextLoading(true);
    try {
      const summary = await getEventHostContextSummary(eventId, token);
      setHostContextSummary(summary);
      return summary;
    } finally {
      setHostContextLoading(false);
    }
  }, [eventId, token]);

  const refreshApprovedParticipants = useCallback(async (cursor?: string | null, append = false) => {
    if (!eventId || !token) return;
    setApprovedParticipantsLoading(true);
    try {
      const response = await listEventApprovedParticipants(eventId, token, {
        limit: hostCollectionPageSize,
        cursor,
      });
      setApprovedParticipants((prev) => append ? [...prev, ...response.items] : response.items);
      setApprovedParticipantsNextCursor(response.page_info.next_cursor);
      setApprovedParticipantsHasNext(response.page_info.has_next);
    } finally {
      setApprovedParticipantsLoading(false);
    }
  }, [eventId, token]);

  const refreshPendingJoinRequests = useCallback(async (cursor?: string | null, append = false) => {
    if (!eventId || !token) return;
    setPendingJoinRequestsLoading(true);
    try {
      const response = await listEventPendingJoinRequests(eventId, token, {
        limit: hostCollectionPageSize,
        cursor,
      });
      setPendingJoinRequests((prev) => append ? [...prev, ...response.items] : response.items);
      setPendingJoinRequestsNextCursor(response.page_info.next_cursor);
      setPendingJoinRequestsHasNext(response.page_info.has_next);
    } finally {
      setPendingJoinRequestsLoading(false);
    }
  }, [eventId, token]);

  const refreshInvitations = useCallback(async (cursor?: string | null, append = false) => {
    if (!eventId || !token) return;
    setInvitationsLoading(true);
    try {
      const response = await listEventInvitations(eventId, token, {
        limit: hostCollectionPageSize,
        cursor,
      });
      setInvitations((prev) => append ? [...prev, ...response.items] : response.items);
      setInvitationsNextCursor(response.page_info.next_cursor);
      setInvitationsHasNext(response.page_info.has_next);
    } finally {
      setInvitationsLoading(false);
    }
  }, [eventId, token]);

  const refreshHostManagement = useCallback(async () => {
    await Promise.all([
      refreshHostContextSummary(),
      refreshApprovedParticipants(undefined, false),
      refreshPendingJoinRequests(undefined, false),
      refreshInvitations(undefined, false),
    ]);
  }, [
    refreshApprovedParticipants,
    refreshHostContextSummary,
    refreshInvitations,
    refreshPendingJoinRequests,
  ]);

  const fetchDetail = useCallback(async () => {
    if (!eventId) {
      setStatus('error');
      setErrorMessage('Invalid event ID.');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);
    resetHostManagement();

    try {
      const data = await refreshEventDetail();
      if (!data) {
        throw new Error('Event detail is unavailable.');
      }
      if (data.viewer_context.is_host && token) {
        void refreshHostManagement();
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
  }, [eventId, refreshEventDetail, refreshHostManagement, resetHostManagement, token]);

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

  const handleLeave = useCallback(async () => {
    if (!eventId || !token) return;
    setLeaveLoading(true);
    setLeaveError(null);

    try {
      await leaveEvent(eventId, token);
      await refreshEventDetail();
    } catch (err) {
      if (err instanceof ApiError) {
        setLeaveError(err.message);
      } else {
        setLeaveError('Failed to leave event. Please try again.');
      }
    } finally {
      setLeaveLoading(false);
    }
  }, [eventId, token, refreshEventDetail]);

  const markViewerPendingJoinRequest = useCallback(() => {
    setEvent((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        viewer_context: {
          ...prev.viewer_context,
          participation_status: 'PENDING',
        },
      };
    });
  }, []);

  const handleRequestJoin = useCallback(async (message?: string) => {
    if (!eventId || !token) return;
    setJoinLoading(true);
    setJoinError(null);

    try {
      await requestJoinEvent(eventId, token, message);
      markViewerPendingJoinRequest();
      try {
        await refreshEventDetail();
      } catch {
        // Keep the optimistic pending state if the follow-up detail fetch is stale or fails.
      }
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
  }, [eventId, token, markViewerPendingJoinRequest, refreshEventDetail]);

  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [moderateError, setModerateError] = useState<string | null>(null);

  const handleApprove = useCallback(async (joinRequestId: string) => {
    if (!eventId || !token) return;
    setModeratingId(joinRequestId);
    setModerateError(null);

    try {
      await approveJoinRequest(eventId, joinRequestId, token);
      await Promise.all([refreshEventDetail(), refreshHostManagement()]);
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
  }, [eventId, token, refreshEventDetail, refreshHostManagement]);

  const handleReject = useCallback(async (joinRequestId: string) => {
    if (!eventId || !token) return;
    setModeratingId(joinRequestId);
    setModerateError(null);

    try {
      await rejectJoinRequest(eventId, joinRequestId, token);
      await Promise.all([refreshEventDetail(), refreshHostManagement()]);
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
  }, [eventId, token, refreshEventDetail, refreshHostManagement]);

  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const handleFavoriteToggle = useCallback(async () => {
    if (!eventId || !token || !event) return;

    const wasFavorited = event.viewer_context.is_favorited;
    const previousCount = event.favorite_count;
    const nextCount = wasFavorited
      ? Math.max(0, previousCount - 1)
      : previousCount + 1;

    setFavoriteLoading(true);
    setEvent((prev) =>
      prev
        ? {
            ...prev,
            favorite_count: nextCount,
            viewer_context: {
              ...prev.viewer_context,
              is_favorited: !wasFavorited,
            },
          }
        : prev,
    );

    try {
      if (wasFavorited) {
        await removeFavorite(eventId, token);
      } else {
        await addFavorite(eventId, token);
      }
    } catch {
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              favorite_count: previousCount,
              viewer_context: {
                ...prev.viewer_context,
                is_favorited: wasFavorited,
              },
            }
          : prev,
      );
    } finally {
      setFavoriteLoading(false);
    }
  }, [eventId, token, event]);

  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancel = useCallback(async () => {
    if (!eventId || !token) return;
    setCancelLoading(true);
    setCancelError(null);

    try {
      await cancelEvent(eventId, token);
      await Promise.all([refreshEventDetail(), refreshHostManagement()]);
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
  }, [eventId, token, refreshEventDetail, refreshHostManagement]);

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
      await Promise.all([refreshEventDetail(), refreshApprovedParticipants(undefined, false)]);
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
  }, [eventId, token, refreshEventDetail, mapRatingError, refreshApprovedParticipants]);

  const dismissJoinError = useCallback(() => setJoinError(null), []);
  const dismissLeaveError = useCallback(() => setLeaveError(null), []);
  const dismissModerateError = useCallback(() => setModerateError(null), []);
  const dismissCancelError = useCallback(() => setCancelError(null), []);
  const dismissViewerRatingError = useCallback(() => setViewerRatingError(null), []);
  const dismissParticipantRatingError = useCallback(() => setParticipantRatingError(null), []);
  const dismissCoverImageError = useCallback(() => setCoverImageError(null), []);

  const dismissCoverImageSuccess = useCallback(() => {
    if (coverImageSuccessTimerRef.current) {
      clearTimeout(coverImageSuccessTimerRef.current);
      coverImageSuccessTimerRef.current = null;
    }
    setCoverImageSuccessMessage(null);
  }, []);

  const handleCoverImageUpload = useCallback(async (file: File) => {
    if (!eventId || !token) return;
    setCoverImageUploading(true);
    setCoverImageError(null);
    dismissCoverImageSuccess();
    try {
      const { original, small } = await prepareAvatarBlobs(file);
      const uploadInit = await getEventImageUploadUrl(eventId, token);
      for (const instruction of uploadInit.uploads) {
        const blob = instruction.variant === 'ORIGINAL' ? original : small;
        const res = await fetch(instruction.url, {
          method: instruction.method,
          headers: instruction.headers,
          body: blob,
        });
        if (!res.ok) {
          throw new Error(`Image upload failed (${instruction.variant}).`);
        }
      }
      await confirmEventImageUpload(eventId, { confirm_token: uploadInit.confirm_token }, token);
      await refreshEventDetail();
      if (coverImageSuccessTimerRef.current) clearTimeout(coverImageSuccessTimerRef.current);
      setCoverImageSuccessMessage('Cover image updated successfully.');
      coverImageSuccessTimerRef.current = setTimeout(() => {
        setCoverImageSuccessMessage(null);
        coverImageSuccessTimerRef.current = null;
      }, 5000);
    } catch (err) {
      if (err instanceof ApiError) {
        setCoverImageError(err.message);
      } else {
        setCoverImageError(err instanceof Error ? err.message : 'Failed to update cover image.');
      }
    } finally {
      setCoverImageUploading(false);
    }
  }, [eventId, token, refreshEventDetail, dismissCoverImageSuccess]);

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

  const loadMoreInvitations = useCallback(async () => {
    if (!invitationsHasNext || !invitationsNextCursor || invitationsLoading) return;
    await refreshInvitations(invitationsNextCursor, true);
  }, [
    invitationsHasNext,
    invitationsLoading,
    invitationsNextCursor,
    refreshInvitations,
  ]);

  return {
    event,
    status,
    errorMessage,
    hostContextSummary,
    hostContextLoading,
    approvedParticipants,
    approvedParticipantsLoading,
    approvedParticipantsHasNext,
    pendingJoinRequests,
    pendingJoinRequestsLoading,
    pendingJoinRequestsHasNext,
    invitations,
    invitationsLoading,
    invitationsHasNext,
    joinLoading,
    joinError,
    leaveLoading,
    leaveError,
    viewerRatingLoading,
    viewerRatingError,
    participantRatingLoadingId,
    participantRatingError,
    moderatingId,
    moderateError,
    cancelLoading,
    cancelError,
    favoriteLoading,
    handleFavoriteToggle,
    retry: fetchDetail,
    handleJoin,
    handleLeave,
    handleRequestJoin,
    handleViewerRatingSubmit,
    handleParticipantRatingSubmit,
    handleApprove,
    handleReject,
    handleCancel,
    dismissJoinError,
    dismissLeaveError,
    dismissViewerRatingError,
    dismissParticipantRatingError,
    dismissModerateError,
    dismissCancelError,
    coverImageUploading,
    coverImageError,
    coverImageSuccessMessage,
    handleCoverImageUpload,
    dismissCoverImageError,
    dismissCoverImageSuccess,
    loadMoreApprovedParticipants,
    loadMorePendingJoinRequests,
    loadMoreInvitations,
  };
}
