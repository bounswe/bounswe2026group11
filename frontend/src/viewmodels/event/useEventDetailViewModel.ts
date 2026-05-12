import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getEventDetail,
  getEventHostContextSummary,
  getEventImageUploadUrl,
  confirmEventImageUpload,
  joinEvent,
  requestJoinEvent,
  getJoinRequestImageUploadUrl,
  cancelMyJoinRequest,
  listEventApprovedParticipants,
  listEventPendingJoinRequests,
  listEventInvitations,
  createEventInvitations,
  approveJoinRequest,
  rejectJoinRequest,
  cancelEvent,
  completeEvent,
  addFavorite,
  removeFavorite,
  upsertEventRating,
  upsertParticipantRating,
  leaveEvent,
  reconfirmEventParticipation,
  createEventReport,
} from '@/services/eventService';
import type {
  EventReportCategory,
  EventDetailApprovedParticipant,
  EventDetailInvitation,
  EventDetailPendingJoinRequest,
  EventDetailResponse,
  EventHostContextSummary,
} from '@/models/event';
import type { CreateEventInvitationsResponse } from '@/models/invitation';
import { ApiError } from '@/services/api';
import i18n from '@/i18n';
import { prepareAvatarBlobs } from '@/utils/imageResize';
import { uploadImageVariants } from '@/utils/directImageUpload';

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
  const [pendingParticipants, setPendingParticipants] = useState<EventDetailApprovedParticipant[]>([]);
  const [pendingParticipantsLoading, setPendingParticipantsLoading] = useState(false);
  const [pendingParticipantsNextCursor, setPendingParticipantsNextCursor] = useState<string | null>(null);
  const [pendingParticipantsHasNext, setPendingParticipantsHasNext] = useState(false);
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
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<CreateEventInvitationsResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccessMessage, setReportSuccessMessage] = useState<string | null>(null);
  const [reconfirmLoading, setReconfirmLoading] = useState(false);
  const [reconfirmError, setReconfirmError] = useState<string | null>(null);
  const [reconfirmSuccessMessage, setReconfirmSuccessMessage] = useState<string | null>(null);

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
    setPendingParticipants([]);
    setPendingParticipantsNextCursor(null);
    setPendingParticipantsHasNext(false);
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

  const refreshPendingParticipants = useCallback(async (cursor?: string | null, append = false) => {
    if (!eventId || !token) return;
    setPendingParticipantsLoading(true);
    try {
      const response = await listEventApprovedParticipants(eventId, token, {
        limit: hostCollectionPageSize,
        cursor,
        status: 'PENDING',
      });
      setPendingParticipants((prev) => append ? [...prev, ...response.items] : response.items);
      setPendingParticipantsNextCursor(response.page_info.next_cursor);
      setPendingParticipantsHasNext(response.page_info.has_next);
    } finally {
      setPendingParticipantsLoading(false);
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
      refreshPendingParticipants(undefined, false),
      refreshPendingJoinRequests(undefined, false),
      refreshInvitations(undefined, false),
    ]);
  }, [
    refreshApprovedParticipants,
    refreshHostContextSummary,
    refreshInvitations,
    refreshPendingParticipants,
    refreshPendingJoinRequests,
  ]);

  const fetchDetail = useCallback(async () => {
    if (!eventId) {
      setStatus('error');
      setErrorMessage(i18n.t('errors.event_detail_invalid_id'));
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
        setErrorMessage(i18n.t('errors.event_detail_load_failed'));
      }
    }
  }, [eventId, refreshEventDetail, refreshHostManagement, resetHostManagement, token]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const markViewerJoined = useCallback(() => {
    setEvent((prev) => {
      if (!prev) return prev;

      const wasJoined = prev.viewer_context.participation_status === 'JOINED' ||
        prev.viewer_context.participation_status === 'APPROVED';

      return {
        ...prev,
        approved_participant_count: wasJoined
          ? prev.approved_participant_count
          : prev.approved_participant_count + 1,
        viewer_context: {
          ...prev.viewer_context,
          participation_status: 'JOINED',
          join_request_status: null,
        },
      };
    });
  }, []);

  const handleJoin = useCallback(async () => {
    if (!eventId || !token) return;
    setJoinLoading(true);
    setJoinError(null);

    try {
      await joinEvent(eventId, token);
      try {
        await refreshEventDetail();
      } catch {
        // Keep the optimistic joined state if the follow-up detail fetch is stale or fails.
      }
      markViewerJoined();
    } catch (err) {
      if (err instanceof ApiError) {
        const errorMap: Record<string, string> = {
          already_participating: i18n.t('errors.event_detail_api_join_already_participating'),
          capacity_exceeded: i18n.t('errors.event_detail_api_join_capacity_exceeded'),
          event_join_not_allowed: i18n.t('errors.event_detail_api_join_not_allowed'),
          host_cannot_join: i18n.t('errors.event_detail_api_join_host_cannot'),
        };
        setJoinError(errorMap[err.code] ?? err.message);
      } else {
        setJoinError(i18n.t('errors.event_detail_join_failed'));
      }
    } finally {
      setJoinLoading(false);
    }
  }, [eventId, token, markViewerJoined, refreshEventDetail]);

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
        setLeaveError(i18n.t('errors.event_detail_leave_failed'));
      }
    } finally {
      setLeaveLoading(false);
    }
  }, [eventId, token, refreshEventDetail]);

  const handleReconfirmParticipation = useCallback(async () => {
    if (!eventId || !token) return;
    setReconfirmLoading(true);
    setReconfirmError(null);
    setReconfirmSuccessMessage(null);

    try {
      const response = await reconfirmEventParticipation(eventId, token);
      await refreshEventDetail();
      setEvent((prev) => prev
        ? {
            ...prev,
            viewer_context: {
              ...prev.viewer_context,
              participation_status: 'JOINED',
              join_request_status: null,
              needs_reconfirmation: false,
              last_confirmed_event_version: response.last_confirmed_event_version,
              latest_event_version: response.latest_event_version,
              event_diff: null,
            },
          }
        : prev);
      setReconfirmSuccessMessage(i18n.t('event_detail.toast_attendance_reconfirmed'));
    } catch (err) {
      if (err instanceof ApiError) {
        const errorMap: Record<string, string> = {
          participation_reconfirm_not_allowed: i18n.t('errors.event_detail_api_reconfirm_stale'),
          event_not_joinable: i18n.t('errors.event_detail_api_reconfirm_not_joinable'),
          host_cannot_join: i18n.t('errors.event_detail_api_reconfirm_host_skip'),
        };
        setReconfirmError(errorMap[err.code] ?? err.message);
      } else {
        setReconfirmError(i18n.t('errors.event_detail_reconfirm_failed'));
      }
    } finally {
      setReconfirmLoading(false);
    }
  }, [eventId, token, refreshEventDetail]);

  const markViewerPendingJoinRequest = useCallback(() => {
    setEvent((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        viewer_context: {
          ...prev.viewer_context,
          join_request_status: 'PENDING',
        },
      };
    });
  }, []);

  const handleRequestJoin = useCallback(
    async (message?: string, imageFile?: File | null) => {
      if (!eventId || !token) return;
      setJoinLoading(true);
      setJoinError(null);

      try {
        let imageConfirmToken: string | undefined;
        if (imageFile) {
          const uploadInit = await getJoinRequestImageUploadUrl(eventId, token);
          const { original, small } = await prepareAvatarBlobs(imageFile);
          await uploadImageVariants(uploadInit, { original, small });
          imageConfirmToken = uploadInit.confirm_token;
        }

        await requestJoinEvent(eventId, token, {
          message,
          image_confirm_token: imageConfirmToken,
        });
        try {
          await refreshEventDetail();
        } catch {
          // Keep the optimistic pending state if the follow-up detail fetch is stale or fails.
        }
        markViewerPendingJoinRequest();
      } catch (err) {
        if (err instanceof ApiError) {
          const errorMap: Record<string, string> = {
            already_participating: i18n.t('errors.event_detail_api_jreq_already_participating'),
            already_requested: i18n.t('errors.event_detail_api_jreq_already_pending'),
            event_join_not_allowed: i18n.t('errors.event_detail_api_jreq_not_allowed'),
            host_cannot_join: i18n.t('errors.event_detail_api_jreq_host_cannot'),
            join_request_cooldown_active: i18n.t('errors.event_detail_api_jreq_cooldown'),
            image_upload_token_invalid: i18n.t('errors.event_detail_api_jreq_image_invalid'),
          };
          setJoinError(errorMap[err.code] ?? err.message);
        } else if (err instanceof Error) {
          setJoinError(err.message);
        } else {
          setJoinError(i18n.t('errors.event_detail_join_request_failed'));
        }
      } finally {
        setJoinLoading(false);
      }
    },
    [eventId, token, markViewerPendingJoinRequest, refreshEventDetail],
  );

  const [cancelJoinRequestLoading, setCancelJoinRequestLoading] = useState(false);
  const [cancelJoinRequestError, setCancelJoinRequestError] = useState<string | null>(null);

  const dismissCancelJoinRequestError = useCallback(() => setCancelJoinRequestError(null), []);

  const handleCancelJoinRequest = useCallback(async () => {
    if (!eventId || !token) return;
    setCancelJoinRequestLoading(true);
    setCancelJoinRequestError(null);

    try {
      await cancelMyJoinRequest(eventId, token);
      // Best-effort refresh — server is authoritative for any drift.
      try {
        await refreshEventDetail();
      } catch {
        // Keep optimistic NONE state if the follow-up fetch fails.
      }
      setEvent((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          viewer_context: {
            ...prev.viewer_context,
            join_request_status: null,
          },
        };
      });
    } catch (err) {
      if (err instanceof ApiError) {
        // 409 typically means the request was already handled (approved/rejected) — refetch
        // so the UI shows the current state instead of the stale PENDING banner.
        if (err.status === 409) {
          try {
            await refreshEventDetail();
          } catch {
            // ignore — we'll still surface the message
          }
          setCancelJoinRequestError(i18n.t('errors.event_detail_cancel_join_status_changed'));
        } else {
          setCancelJoinRequestError(err.message || i18n.t('errors.event_detail_cancel_join_request_failed'));
        }
      } else {
        setCancelJoinRequestError(i18n.t('errors.event_detail_cancel_join_request_failed'));
      }
    } finally {
      setCancelJoinRequestLoading(false);
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
      await Promise.all([refreshEventDetail(), refreshHostManagement()]);
    } catch (err) {
      if (err instanceof ApiError) {
        const errorMap: Record<string, string> = {
          join_request_state_invalid: i18n.t('errors.event_detail_api_mod_not_pending'),
          capacity_exceeded: i18n.t('errors.event_detail_api_mod_capacity_full'),
          already_participating: i18n.t('errors.event_detail_api_mod_already_participating'),
          join_request_moderation_not_allowed: i18n.t('errors.event_detail_api_mod_host_only'),
        };
        setModerateError(errorMap[err.code] ?? err.message);
      } else {
        setModerateError(i18n.t('errors.event_detail_moderate_approve_failed'));
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
          join_request_state_invalid: i18n.t('errors.event_detail_api_mod_not_pending'),
          join_request_moderation_not_allowed: i18n.t('errors.event_detail_api_mod_host_only'),
        };
        setModerateError(errorMap[err.code] ?? err.message);
      } else {
        setModerateError(i18n.t('errors.event_detail_moderate_reject_failed'));
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
  const [completeLoading, setCompleteLoading] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

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
          event_cancel_not_allowed: i18n.t('errors.event_detail_api_cancel_host_only'),
          event_not_cancelable: i18n.t('errors.event_detail_api_cancel_not_active'),
        };
        setCancelError(errorMap[err.code] ?? err.message);
      } else {
        setCancelError(i18n.t('errors.event_detail_cancel_event_failed'));
      }
    } finally {
      setCancelLoading(false);
    }
  }, [eventId, token, refreshEventDetail, refreshHostManagement]);

  const handleComplete = useCallback(async () => {
    if (!eventId || !token) return;
    setCompleteLoading(true);
    setCompleteError(null);

    try {
      await completeEvent(eventId, token);
      await Promise.all([refreshEventDetail(), refreshHostManagement()]);
    } catch (err) {
      if (err instanceof ApiError) {
        const errorMap: Record<string, string> = {
          event_complete_not_allowed: i18n.t('errors.event_detail_api_end_host_only'),
          event_not_completable: i18n.t('errors.event_detail_api_end_not_now'),
        };
        setCompleteError(errorMap[err.code] ?? err.message);
      } else {
        setCompleteError(i18n.t('errors.event_detail_complete_failed'));
      }
    } finally {
      setCompleteLoading(false);
    }
  }, [eventId, token, refreshEventDetail, refreshHostManagement]);

  const mapRatingError = useCallback((err: ApiError, fallback: string) => {
    const errorMap: Record<string, string> = {
      rating_not_allowed: i18n.t('errors.event_detail_api_rate_not_allowed'),
      rating_window_closed: i18n.t('errors.event_detail_api_rate_window_closed'),
      host_cannot_rate_self: i18n.t('errors.event_detail_api_rate_no_self'),
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
        setViewerRatingError(mapRatingError(err, i18n.t('errors.event_detail_rating_save_failed')));
      } else {
        setViewerRatingError(i18n.t('errors.event_detail_rating_save_failed'));
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
          message: mapRatingError(err, i18n.t('errors.event_detail_participant_rating_failed')),
        });
      } else {
        setParticipantRatingError({
          participantUserId,
          message: i18n.t('errors.event_detail_participant_rating_failed'),
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
  const dismissCompleteError = useCallback(() => setCompleteError(null), []);
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
      await uploadImageVariants(uploadInit, { original, small });
      await confirmEventImageUpload(eventId, { confirm_token: uploadInit.confirm_token }, token);
      await refreshEventDetail();
      if (coverImageSuccessTimerRef.current) clearTimeout(coverImageSuccessTimerRef.current);
      setCoverImageSuccessMessage(i18n.t('event_detail.toast_cover_updated'));
      coverImageSuccessTimerRef.current = setTimeout(() => {
        setCoverImageSuccessMessage(null);
        coverImageSuccessTimerRef.current = null;
      }, 5000);
    } catch (err) {
      if (err instanceof ApiError) {
        setCoverImageError(err.message);
      } else {
        setCoverImageError(err instanceof Error ? err.message : i18n.t('errors.event_detail_cover_image_failed'));
      }
    } finally {
      setCoverImageUploading(false);
    }
  }, [eventId, token, refreshEventDetail, dismissCoverImageSuccess]);

  const handleReportEvent = useCallback(async (
    reportCategory: EventReportCategory,
    message?: string,
  ): Promise<boolean> => {
    if (!eventId || !token) return false;
    setReportLoading(true);
    setReportError(null);
    setReportSuccessMessage(null);

    try {
      await createEventReport(
        eventId,
        {
          report_category: reportCategory,
          message: message?.trim() || i18n.t('event_detail.report_default_message'),
        },
        token,
      );
      setReportSuccessMessage(i18n.t('event_detail.toast_report_submitted'));
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        const duplicateMsg = i18n.t('errors.event_detail_api_report_duplicate');
        const errorMap: Record<string, string> = {
          event_report_not_allowed: i18n.t('errors.event_detail_api_report_blocked'),
          already_reported: duplicateMsg,
          duplicate_report: duplicateMsg,
          event_report_duplicate: duplicateMsg,
          validation_error: err.details?.message ?? err.message,
        };
        if (err.status === 409) {
          setReportError(errorMap[err.code] ?? duplicateMsg);
        } else {
          setReportError(errorMap[err.code] ?? err.message);
        }
      } else {
        setReportError(i18n.t('errors.event_detail_report_failed'));
      }
      return false;
    } finally {
      setReportLoading(false);
    }
  }, [eventId, token]);

  const loadMoreApprovedParticipants = useCallback(async () => {
    if (!approvedParticipantsHasNext || !approvedParticipantsNextCursor || approvedParticipantsLoading) return;
    await refreshApprovedParticipants(approvedParticipantsNextCursor, true);
  }, [
    approvedParticipantsHasNext,
    approvedParticipantsLoading,
    approvedParticipantsNextCursor,
    refreshApprovedParticipants,
  ]);

  const loadMorePendingParticipants = useCallback(async () => {
    if (!pendingParticipantsHasNext || !pendingParticipantsNextCursor || pendingParticipantsLoading) return;
    await refreshPendingParticipants(pendingParticipantsNextCursor, true);
  }, [
    pendingParticipantsHasNext,
    pendingParticipantsLoading,
    pendingParticipantsNextCursor,
    refreshPendingParticipants,
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

  const handleCreateInvitations = useCallback(
    async (usernames: string[], message: string | null): Promise<CreateEventInvitationsResponse | null> => {
      if (!eventId || !token) return null;
      setInviteLoading(true);
      setInviteError(null);
      setInviteResult(null);
      try {
        const response = await createEventInvitations(
          eventId,
          { usernames, message: message ?? null },
          token,
        );
        setInviteResult(response);
        // Refresh invitations and host summary so counts and list update
        await Promise.all([refreshInvitations(undefined, false), refreshHostContextSummary()]);
        return response;
      } catch (err) {
        setInviteError(err instanceof ApiError ? err.message : i18n.t('errors.event_detail_invite_failed'));
        return null;
      } finally {
        setInviteLoading(false);
      }
    },
    [eventId, token, refreshInvitations, refreshHostContextSummary],
  );

  const dismissInviteError = useCallback(() => setInviteError(null), []);
  const clearInviteResult = useCallback(() => setInviteResult(null), []);
  const dismissReportError = useCallback(() => setReportError(null), []);
  const dismissReportSuccess = useCallback(() => setReportSuccessMessage(null), []);

  return {
    event,
    status,
    errorMessage,
    hostContextSummary,
    hostContextLoading,
    approvedParticipants,
    approvedParticipantsLoading,
    approvedParticipantsHasNext,
    pendingParticipants,
    pendingParticipantsLoading,
    pendingParticipantsHasNext,
    pendingJoinRequests,
    pendingJoinRequestsLoading,
    pendingJoinRequestsHasNext,
    invitations,
    invitationsLoading,
    invitationsHasNext,
    inviteLoading,
    inviteError,
    inviteResult,
    handleCreateInvitations,
    dismissInviteError,
    clearInviteResult,
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
    completeLoading,
    completeError,
    favoriteLoading,
    reportLoading,
    reportError,
    reportSuccessMessage,
    reconfirmLoading,
    reconfirmError,
    reconfirmSuccessMessage,
    handleFavoriteToggle,
    handleReportEvent,
    retry: fetchDetail,
    handleJoin,
    handleLeave,
    handleReconfirmParticipation,
    handleRequestJoin,
    cancelJoinRequestLoading,
    cancelJoinRequestError,
    handleCancelJoinRequest,
    dismissCancelJoinRequestError,
    handleViewerRatingSubmit,
    handleParticipantRatingSubmit,
    handleApprove,
    handleReject,
    handleCancel,
    handleComplete,
    dismissJoinError,
    dismissLeaveError,
    dismissReconfirmError: () => setReconfirmError(null),
    dismissReconfirmSuccess: () => setReconfirmSuccessMessage(null),
    dismissViewerRatingError,
    dismissParticipantRatingError,
    dismissModerateError,
    dismissCancelError,
    dismissCompleteError,
    coverImageUploading,
    coverImageError,
    coverImageSuccessMessage,
    handleCoverImageUpload,
    dismissCoverImageError,
    dismissCoverImageSuccess,
    dismissReportError,
    dismissReportSuccess,
    loadMoreApprovedParticipants,
    loadMorePendingParticipants,
    loadMorePendingJoinRequests,
    loadMoreInvitations,
  };
}
