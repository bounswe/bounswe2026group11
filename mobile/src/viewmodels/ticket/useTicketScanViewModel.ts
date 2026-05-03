import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/services/api';
import { getEventDetail } from '@/services/eventService';
import { scanTicket } from '@/services/ticketService';
import type { EventDetail } from '@/models/event';
import type { TicketScanResponse } from '@/models/ticket';

export interface TicketScanViewModel {
  event: EventDetail | null;
  qrToken: string;
  scanResult: TicketScanResponse | null;
  isLoading: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  setQrToken: (value: string) => void;
  submit: () => Promise<void>;
  submitToken: (value: string) => Promise<void>;
  reload: () => Promise<void>;
}

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'You must be logged in to scan tickets.';
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  return 'Failed to load the scan screen. Please try again.';
}

export function useTicketScanViewModel(eventId: string): TicketScanViewModel {
  const { token } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [qrToken, setQrToken] = useState('');
  const [scanResult, setScanResult] = useState<TicketScanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) {
      setEvent(null);
      setErrorMessage('You must be logged in to scan tickets.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const eventDetail = await getEventDetail(eventId, token);
      setEvent(eventDetail);
    } catch (error) {
      setEvent(null);
      setErrorMessage(getLoadErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [eventId, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const submitToken = useCallback(async (value: string) => {
    if (!token || isSubmitting) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setErrorMessage('Enter a QR token before validating the ticket.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setScanResult(null);
    setQrToken(trimmed);

    try {
      const result = await scanTicket(eventId, trimmed, token);
      setScanResult(result);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : 'Failed to validate the ticket.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [eventId, isSubmitting, token]);

  const submit = useCallback(async () => {
    await submitToken(qrToken);
  }, [qrToken, submitToken]);

  return {
    event,
    qrToken,
    scanResult,
    isLoading,
    isSubmitting,
    errorMessage,
    setQrToken,
    submit,
    submitToken,
    reload,
  };
}
