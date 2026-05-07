import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ExpoLocation from 'expo-location';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/services/api';
import { getEventDetail } from '@/services/eventService';
import { getMyTicket, getTicketQrTokenOnce, getTicketQrTokenStream } from '@/services/ticketService';
import type { EventDetail } from '@/models/event';
import type { TicketDetailResponse, TicketQrToken } from '@/models/ticket';
import { getTicketQrAccessMessage } from '@/utils/ticketStatus';

// GLOBAL REGISTRY: Keep track of active stream controllers across the whole app
// to prevent "ghost" connections when navigating back and forth.
const activeStreams = new Map<string, AbortController>();

export interface TicketViewModel {
  ticket: TicketDetailResponse | null;
  eventImageUrl: string | null;
  qrToken: TicketQrToken | null;
  isLoading: boolean;
  isRefreshingQr: boolean;
  errorMessage: string | null;
  qrMessage: string | null;
  canRetryQr: boolean;
  reload: () => Promise<void>;
  refreshQr: () => Promise<void>;
}

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'You must be logged in to view this ticket.';
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  return 'Failed to load the ticket. Please try again.';
}

async function getCurrentCoordinates() {
  const permission = await ExpoLocation.requestForegroundPermissionsAsync();
  if (permission.status !== ExpoLocation.PermissionStatus.GRANTED) {
    throw new Error('Location permission is required to reveal this live ticket QR.');
  }

  let position;
  try {
    position = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.High,
    });
  } catch (error) {
    // Fallback to balanced if high accuracy fails
    position = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.Balanced,
    });
  }

  return {
    lat: position.coords.latitude,
    lon: position.coords.longitude,
  };
}

export function useTicketViewModel(ticketId: string): TicketViewModel {
  const { token } = useAuth();
  const [ticket, setTicket] = useState<TicketDetailResponse | null>(null);
  const [eventImageUrl, setEventImageUrl] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<TicketQrToken | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingQr, setIsRefreshingQr] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qrMessage, setQrMessage] = useState<string | null>(null);

  const loadTicket = useCallback(async () => {
    if (!token) {
      setTicket(null);
      setEventImageUrl(null);
      setQrToken(null);
      setErrorMessage('You must be logged in to view this ticket.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Fetch ticket details first
      const ticketDetail = await getMyTicket(ticketId, token);
      setTicket(ticketDetail);
      
      // OPTIMIZATION: Hide loading spinner as soon as we have ticket data
      // The image can continue loading in the background
      setIsLoading(false);

      try {
        const eventDetail = await getEventDetail(ticketDetail.event.id, token);
        setEventImageUrl(eventDetail?.image_url ?? null);
      } catch (e) {
        setEventImageUrl(null);
      }
    } catch (error) {
      setTicket(null);
      setEventImageUrl(null);
      setQrToken(null);
      setErrorMessage(getLoadErrorMessage(error));
      setIsLoading(false); // Make sure to stop loading on error too
    }
  }, [ticketId, token]);

  const isRefreshingRef = useRef(false);
  const ticketRef = useRef(ticket);
  const tokenRef = useRef(token);

  useEffect(() => {
    ticketRef.current = ticket;
    tokenRef.current = token;
  }, [ticket, token]);

  const refreshQr = useCallback(async () => {
    const currentTicket = ticketRef.current;
    const currentToken = tokenRef.current;

    if (!currentToken || !currentTicket || isRefreshingRef.current) return;

    if (!currentTicket.qr_access.eligible_now) {
      setQrToken(null);
      setQrMessage(getTicketQrAccessMessage(currentTicket.qr_access.reason));
      return;
    }

    isRefreshingRef.current = true;
    setIsRefreshingQr(true);
    setQrMessage(null);

    try {
      const coords = await getCurrentCoordinates();
      const tokenPayload = await getTicketQrTokenOnce(currentTicket.ticket.id, coords, currentToken);
      setQrToken(tokenPayload);
    } catch (error) {
      setQrToken(null);
      setQrMessage(
        error instanceof Error
          ? error.message
          : 'Failed to refresh the live QR token.',
      );
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshingQr(false);
    }
  }, []);

  useEffect(() => {
    void loadTicket();
  }, [loadTicket]);

  // Handle the streaming QR token
  useEffect(() => {
    // We only want to start the stream if:
    // 1. Ticket is ACTIVE
    // 2. User is ELIGIBLE (proximity etc. checks passed on backend)
    // 3. Auth token exists
    const canStream =
      ticket?.ticket.id &&
      ticket.ticket.status === 'ACTIVE' &&
      ticket.qr_access.eligible_now &&
      token;

    if (!canStream) {
      return;
    }

    const currentTicketId = ticket.ticket.id;
    let active = true;

    // KILL any existing stream for this specific ticket ID before starting a new one
    const existing = activeStreams.get(currentTicketId);
    if (existing) {
      existing.abort();
      activeStreams.delete(currentTicketId);
    }

    const abortController = new AbortController();
    activeStreams.set(currentTicketId, abortController);

    const startStream = async () => {
      const streamId = Math.random().toString(36).substring(7);

      try {
        // [P1 FIX] Check permission status BEFORE starting the stream loop.
        // We use getPermissions instead of requestPermissions to avoid "surprise" popups on mount.
        const permission = await ExpoLocation.getForegroundPermissionsAsync();
        if (permission.status !== ExpoLocation.PermissionStatus.GRANTED) {
          // If permission is not granted, we don't start the auto-stream.
          // The UI will show the "locked" state and the user can manually "Refresh"
          // which WILL trigger the requestPermission popup.
          return;
        }

        const coords = await getCurrentCoordinates();

        // Final check before opening the connection
        if (!active || abortController.signal.aborted) return;

        const stream = getTicketQrTokenStream(
          currentTicketId,
          coords,
          token,
          abortController.signal,
          streamId,
        );

        for await (const tokenData of stream) {
          if (!active || abortController.signal.aborted) break;
          setQrToken(tokenData);
          setQrMessage(null);
        }

        // Stream ended normally — likely means the ticket was scanned/used.
        // Reload ticket data so participant sees the updated status immediately.
        if (active && !abortController.signal.aborted) {
          try {
            const updatedTicket = await getMyTicket(currentTicketId, token);
            setTicket(updatedTicket);
          } catch {
            // Silently ignore — the user can always pull-to-refresh
          }
        }
      } catch (err) {
        if (active && !abortController.signal.aborted && err instanceof Error && err.name !== 'AbortError') {
          // Stream closed — always reload the ticket to check if it was used.
          try {
            const updatedTicket = await getMyTicket(currentTicketId, token);
            setTicket(updatedTicket);

            // If the ticket was used, clear the QR and stop retrying.
            if (updatedTicket.ticket.status === 'USED') {
              setQrToken(null);
              setQrMessage(null);
              return;
            }
          } catch {
            // Ignore reload errors — fall through to normal error handling
          }

          const message = err.message;
          setQrMessage(message);

          // Permanent errors (Proximity, Privacy, etc.) usually include a specific status or message.
          // If it's a permanent error, we stop the aggressive retry loop.
          const isPermanentError =
            message.includes('Status 403') ||
            message.includes('Status 409') ||
            message.includes('near the event location') ||
            message.includes('support mobile tickets') ||
            message.includes('ACTIVE tickets');

          if (isPermanentError) {
            return;
          }

          // For actual network interruptions, we still retry but with a backoff
          setTimeout(() => {
            if (active && !abortController.signal.aborted) void startStream();
          }, 15000);
        }
      }
    };

    void startStream();

    return () => {
      active = false;
      abortController.abort();
      if (activeStreams.get(currentTicketId) === abortController) {
        activeStreams.delete(currentTicketId);
      }
    };
  }, [ticket?.ticket.id, ticket?.ticket.status, ticket?.qr_access.eligible_now, token]);

  const canRetryQr = useMemo(
    () => ticket?.ticket.status === 'ACTIVE',
    [ticket?.ticket.status],
  );

  return {
    ticket,
    eventImageUrl,
    qrToken,
    isLoading,
    isRefreshingQr,
    errorMessage,
    qrMessage,
    canRetryQr,
    reload: loadTicket,
    refreshQr,
  };
}
