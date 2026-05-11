import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ExpoLocation from 'expo-location';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/services/api';
import { getEventDetail } from '@/services/eventService';
import { getMyTicket, getTicketQrTokenOnce } from '@/services/ticketService';
import type { EventDetail } from '@/models/event';
import type { TicketDetailResponse, TicketQrToken } from '@/models/ticket';
import { getTicketQrAccessMessage } from '@/utils/ticketStatus';
import i18n from '@/i18n';

// GLOBAL REGISTRY: Keep track of active stream controllers across the whole app
// to prevent "ghost" connections when navigating back and forth.
const activeStreams = new Map<string, AbortController>();

export interface TicketViewModel {
  ticket: TicketDetailResponse | null;
  eventImageUrl: string | null;
  isLoading: boolean;
  apiError: string | null;
  qrToken: TicketQrToken | null;
  qrMessage: string | null;
  isActionLoading: boolean;
  secondsRemaining: number | null;
  refresh: () => Promise<void>;
  resetError: () => void;
}

export function useTicketViewModel(ticketId: string): TicketViewModel {
  const { user, token } = useAuth();
  const [ticket, setTicket] = useState<TicketDetailResponse | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<TicketQrToken | null>(null);
  const [qrMessage, setQrMessage] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  const pollingRef = useRef<boolean>(false);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTicketAndEvent = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setApiError(null);

    try {
      const ticketData = await getMyTicket(ticketId, token);
      setTicket(ticketData);

      if (!ticketData.qr_access.eligible_now) {
        setQrMessage(getTicketQrAccessMessage(ticketData.qr_access.reason));
      }

      const eventData = await getEventDetail(ticketData.event.id, token);
      setEvent(eventData);
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else {
        setApiError(i18n.t('tickets.detail.errors.unexpected'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [ticketId, token]);

  const resetError = useCallback(() => setApiError(null), []);

  const stopPolling = useCallback(() => {
    pollingRef.current = false;
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(async () => {
    if (!token || !ticketId || pollingRef.current) return;

    pollingRef.current = true;
    const abortController = new AbortController();
    activeStreams.set(ticketId, abortController);

    const poll = async () => {
      if (!pollingRef.current) return;

      try {
        let location = null;
        try {
          location = await ExpoLocation.getCurrentPositionAsync({
            accuracy: ExpoLocation.Accuracy.Balanced,
          });
        } catch {
          setQrMessage(i18n.t('tickets.qr.enableLocationServices'));
          pollingTimeoutRef.current = setTimeout(poll, 10000);
          return;
        }

        // We fetch both in parallel using allSettled. 
        // This ensures that if getTicketQrTokenOnce fails (e.g. ticket scanned),
        // we still receive and process the latest ticket status from getMyTicket.
        const [ticketResult, tokenResult] = await Promise.allSettled([
          getMyTicket(ticketId, token),
          getTicketQrTokenOnce(
            ticketId,
            { lat: location.coords.latitude, lon: location.coords.longitude },
            token
          )
        ]);

        // 1. Update ticket detail/status if successful
        if (ticketResult.status === 'fulfilled') {
          const ticketData = ticketResult.value;
          setTicket(ticketData);
          
          if (ticketData.ticket.status !== 'ACTIVE') {
            // Ticket is USED or CANCELED, stop polling immediately
            stopPolling();
            return;
          }
        }

        // 2. Update QR token if successful
        if (tokenResult.status === 'fulfilled') {
          const tokenData = tokenResult.value;
          setQrMessage(null);
          setQrToken(tokenData);
          
          // Setup countdown
          const expiresAt = new Date(tokenData.expires_at).getTime();
          const updateCountdown = () => {
            const now = Date.now();
            const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
            setSecondsRemaining(diff);
            
            if (diff <= 0) {
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
              }
            }
          };

          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
          updateCountdown();
          countdownIntervalRef.current = setInterval(updateCountdown, 1000);
        } else {
          // Token fetch failed (might be because of scan)
          const err = tokenResult.reason;
          if (err instanceof Error && err.message === 'AbortError') return;
          
          const message = err instanceof ApiError ? err.message : i18n.t('tickets.qr.connectionLost');
          setQrMessage(getTicketQrAccessMessage(message));
        }

        // Schedule next poll if still active
        if (pollingRef.current) {
          pollingTimeoutRef.current = setTimeout(poll, 10000);
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'AbortError') return;
        
        const message = err instanceof ApiError ? err.message : i18n.t('tickets.qr.connectionLost');
        setQrMessage(getTicketQrAccessMessage(message));

        // Retry later on error
        if (pollingRef.current) {
          pollingTimeoutRef.current = setTimeout(poll, 15000);
        }
      }
    };

    void poll();
  }, [ticketId, token]);

  useEffect(() => {
    void fetchTicketAndEvent();
    return () => {
      stopPolling();
      const controller = activeStreams.get(ticketId);
      if (controller) {
        controller.abort();
        activeStreams.delete(ticketId);
      }
    };
  }, [fetchTicketAndEvent, stopPolling, ticketId]);

  useEffect(() => {
    if (ticket && ticket.ticket.status === 'ACTIVE' && ticket.qr_access.eligible_now) {
      void startPolling();
    } else {
      stopPolling();
    }
  }, [ticket, startPolling, stopPolling]);

  const refresh = useCallback(async () => {
    stopPolling();
    setTicket(null);
    setQrToken(null);
    setQrMessage(null);
    setSecondsRemaining(null);
    await fetchTicketAndEvent();
  }, [fetchTicketAndEvent, stopPolling]);

  return {
    ticket,
    eventImageUrl: event?.image_url ?? null,
    isLoading,
    apiError,
    qrToken,
    qrMessage,
    isActionLoading,
    secondsRemaining,
    refresh,
    resetError,
  };
}
