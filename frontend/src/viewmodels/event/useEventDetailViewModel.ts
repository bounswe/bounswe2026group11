import { useState, useEffect, useCallback } from 'react';
import { getEventDetail } from '@/services/eventService';
import type { EventDetailResponse } from '@/models/event';
import { ApiError } from '@/services/api';

export type DetailStatus = 'loading' | 'ready' | 'not-found' | 'forbidden' | 'error';

export function useEventDetailViewModel(eventId: string | undefined, token: string | null) {
  const [event, setEvent] = useState<EventDetailResponse | null>(null);
  const [status, setStatus] = useState<DetailStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  return {
    event,
    status,
    errorMessage,
    retry: fetchDetail,
  };
}
