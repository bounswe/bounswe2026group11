import { BASE_URL, ApiError } from '@/services/api';
import type {
  ListTicketsResponse,
  TicketDetailResponse,
  TicketQrToken,
  TicketScanResponse,
} from '@/models/ticket';
import { getCurrentSession, refreshSession } from '@/services/sessionManager';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
}

async function parseErrorResponse(response: Response): Promise<ErrorResponse> {
  try {
    return await response.json();
  } catch {
    return {
      error: {
        code: 'unknown_error',
        message: 'An unexpected error occurred.',
      },
    };
  }
}

async function ticketRequest(
  endpoint: string,
  init: RequestInit,
  options?: { token?: string; requiresAuth?: boolean; hasRetried?: boolean },
): Promise<Response> {
  const activeToken =
    options?.requiresAuth
      ? getCurrentSession()?.access_token ?? options?.token
      : undefined;

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };

  if (!headers['Content-Type'] && init.method && init.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  if (activeToken) {
    headers.Authorization = `Bearer ${activeToken}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...init,
    headers,
  });

  if (
    options?.requiresAuth &&
    response.status === 401 &&
    !options?.hasRetried &&
    getCurrentSession()?.refresh_token
  ) {
    const refreshedSession = await refreshSession();
    return ticketRequest(endpoint, init, {
      ...options,
      token: refreshedSession.access_token,
      hasRetried: true,
    });
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorResponse(response));
  }

  return response;
}

async function ticketJsonRequest<T>(
  endpoint: string,
  init: RequestInit,
  token: string,
): Promise<T> {
  const response = await ticketRequest(
    endpoint,
    init,
    { token, requiresAuth: true },
  );

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export function listMyTickets(token: string): Promise<ListTicketsResponse> {
  return ticketJsonRequest<ListTicketsResponse>('/me/tickets', { method: 'GET' }, token);
}

export function getMyTicket(ticketId: string, token: string): Promise<TicketDetailResponse> {
  return ticketJsonRequest<TicketDetailResponse>(`/me/tickets/${ticketId}`, { method: 'GET' }, token);
}

export function scanTicket(
  eventId: string,
  qrToken: string,
  token: string,
): Promise<TicketScanResponse> {
  return ticketJsonRequest<TicketScanResponse>(
    `/host/events/${eventId}/ticket-scans`,
    {
      method: 'POST',
      headers: {
        'X-Client-Surface': 'MOBILE',
      },
      body: JSON.stringify({ qr_token: qrToken }),
    },
    token,
  );
}

export async function* getTicketQrTokenStream(
  ticketId: string,
  coords: { lat: number; lon: number },
  token: string,
  signal?: AbortSignal,
  streamId?: string,
): AsyncGenerator<TicketQrToken> {
  const url = `${BASE_URL}/me/tickets/${ticketId}/qr-stream?lat=${encodeURIComponent(String(coords.lat))}&lon=${encodeURIComponent(String(coords.lon))}`;

  // Using XMLHttpRequest because fetch doesn't support streaming on all RN versions/platforms
  const xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.setRequestHeader('X-Client-Surface', 'MOBILE');
  xhr.setRequestHeader('Accept', 'text/event-stream');
  xhr.setRequestHeader('Authorization', `Bearer ${token}`);

  let lastIndex = 0;

  // Since we need to return values from an event listener in an async generator, 
  // we'll use a queue.
  const queue: (TicketQrToken | Error)[] = [];
  let resolveNext: ((value: TicketQrToken | Error) => void) | null = null;

  const pushToQueue = (item: TicketQrToken | Error) => {
    if (resolveNext) {
      resolveNext(item);
      resolveNext = null;
    } else {
      queue.push(item);
    }
  };

  xhr.onprogress = () => {
    const newText = xhr.responseText.substring(lastIndex);
    lastIndex = xhr.responseText.length;

    const lines = newText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:')) {
        const payload = trimmed.replace(/^data:\s*/, '');
        try {
          const data = JSON.parse(payload);
          if (data.token) {
            pushToQueue(data as TicketQrToken);
          }
        } catch {
          // Chunk might be incomplete
        }
      }
    }
  };

  xhr.onerror = () => {
    pushToQueue(new Error('Stream network error'));
  };

  xhr.onload = () => {
    if (xhr.status !== 200) {
      let errorMessage = `Stream failed (Status ${xhr.status})`;
      try {
        const errorData = JSON.parse(xhr.responseText);
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch {
        // Fallback
      }
      pushToQueue(new Error(errorMessage));
    } else {
      pushToQueue(new Error('Stream closed unexpectedly'));
    }
  };

  xhr.onreadystatechange = () => {
    if (xhr.readyState === 2 && xhr.status !== 200) {
      // Status received but not 200, will be handled in onload
    }
  };

  const cleanup = () => {
    xhr.onprogress = null;
    xhr.onload = null;
    xhr.onerror = null;
    xhr.onreadystatechange = null;
    try {
      xhr.abort();
    } catch {
      // Ignore
    }
  };

  if (signal) {
    signal.addEventListener('abort', () => {
      cleanup();
      // Important: Push an error to break the while(true) loop that's likely 
      // awaiting on the promise in pushToQueue.
      pushToQueue(new Error('AbortError'));
    });
  }

  xhr.send();

  try {
    while (true) {
      const item = queue.length > 0 
        ? queue.shift()! 
        : await new Promise<TicketQrToken | Error>((resolve) => {
            resolveNext = resolve;
          });

      if (item instanceof Error) {
        if (item.message === 'AbortError') return;
        throw item;
      }
      yield item;
    }
  } finally {
    cleanup();
  }
}

export async function getTicketQrTokenOnce(
  ticketId: string,
  coords: { lat: number; lon: number },
  token: string,
): Promise<TicketQrToken> {
  const url = `${BASE_URL}/me/tickets/${ticketId}/qr-stream?lat=${encodeURIComponent(String(coords.lat))}&lon=${encodeURIComponent(String(coords.lon))}`;

  return new Promise<TicketQrToken>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('X-Client-Surface', 'MOBILE');
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    let settled = false;
    let lastIndex = 0;
    let buffer = '';

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out while waiting for the live QR token.'));
    }, 15000);

    const settle = (handler: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      cleanup();
      handler();
    };

    const parseBufferedEvents = () => {
      const newText = xhr.responseText.substring(lastIndex);
      lastIndex = xhr.responseText.length;
      buffer += newText;

      const eventBlocks = buffer.split('\n\n');
      buffer = eventBlocks.pop() ?? '';

      for (const block of eventBlocks) {
        const lines = block
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        const eventName = lines.find((line) => line.startsWith('event:'))?.replace(/^event:\s*/, '');
        const dataLine = lines.find((line) => line.startsWith('data:'));

        if (!dataLine) {
          continue;
        }

        try {
          const data = JSON.parse(dataLine.replace(/^data:\s*/, ''));
          if (eventName === 'error') {
            settle(() => reject(new Error(data.message ?? 'Failed to load the live QR token.')));
            return;
          }

          if (data.token) {
            settle(() => resolve(data as TicketQrToken));
            return;
          }
        } catch {
          // Wait for more chunks if the payload is incomplete.
        }
      }
    };

    xhr.onprogress = () => {
      parseBufferedEvents();
    };

    xhr.onerror = () => {
      settle(() => reject(new Error('Stream network error')));
    };

    xhr.onload = () => {
      parseBufferedEvents();

      if (settled) {
        return;
      }

      if (xhr.status !== 200) {
        let errorMessage = `Stream failed (Status ${xhr.status})`;
        try {
          const errorData = JSON.parse(xhr.responseText);
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          }
        } catch {
          // Fallback
        }
        settle(() => reject(new Error(errorMessage)));
        return;
      }

      settle(() => reject(new Error('No QR token received')));
    };

    const cleanup = () => {
      xhr.onprogress = null;
      xhr.onload = null;
      xhr.onerror = null;
      try {
        xhr.abort();
      } catch {
        // Ignore
      }
    };

    xhr.send();
  });
}
