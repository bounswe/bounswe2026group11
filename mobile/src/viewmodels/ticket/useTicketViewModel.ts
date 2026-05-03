import { useCallback, useEffect, useMemo, useState } from 'react';
import * as ExpoLocation from 'expo-location';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/services/api';
import { getEventDetail } from '@/services/eventService';
import { getMyTicket, getTicketQrTokenOnce } from '@/services/ticketService';
import type { EventDetail } from '@/models/event';
import type { TicketDetailResponse, TicketQrToken } from '@/models/ticket';
import { getTicketQrAccessMessage } from '@/utils/ticketStatus';

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
    position = await Promise.race([
      ExpoLocation.getLastKnownPositionAsync(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000))
    ]);
  } catch {
    position = null;
  }

  if (!position) {
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
      const ticketDetail = await getMyTicket(ticketId, token);
      setTicket(ticketDetail);

      let eventDetail: EventDetail | null = null;
      try {
        eventDetail = await getEventDetail(ticketDetail.event.id, token);
      } catch {
        eventDetail = null;
      }

      setEventImageUrl(eventDetail?.image_url ?? null);
    } catch (error) {
      setTicket(null);
      setEventImageUrl(null);
      setQrToken(null);
      setErrorMessage(getLoadErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [ticketId, token]);

  const refreshQr = useCallback(async () => {
    if (!token || !ticket) return;

    if (!ticket.qr_access.eligible_now) {
      setQrToken(null);
      setQrMessage(getTicketQrAccessMessage(ticket.qr_access.reason));
      return;
    }

    setIsRefreshingQr(true);
    setQrMessage(null);

    try {
      const coords = await getCurrentCoordinates();
      const tokenPayload = await getTicketQrTokenOnce(ticket.ticket.id, coords, token);
      setQrToken(tokenPayload);
    } catch (error) {
      setQrToken(null);
      setQrMessage(
        error instanceof Error
          ? error.message
          : 'Failed to refresh the live QR token.',
      );
    } finally {
      setIsRefreshingQr(false);
    }
  }, [ticket, token]);

  useEffect(() => {
    void loadTicket();
  }, [loadTicket]);

  useEffect(() => {
    if (!ticket) return;
    void refreshQr();
  }, [ticket, refreshQr]);

  useEffect(() => {
    if (!qrToken || ticket?.ticket.status !== 'ACTIVE') return;

    const interval = setInterval(() => {
      void refreshQr();
    }, 8000);

    return () => clearInterval(interval);
  }, [qrToken, refreshQr, ticket?.ticket.status]);

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
