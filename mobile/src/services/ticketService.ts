import { BASE_URL, ApiError } from '@/services/api';
import { getCurrentLocale } from '@/contexts/LocaleContext';
import type {
  ListTicketsResponse,
  TicketDetailResponse,
  TicketQrToken,
  TicketScanResponse,
} from '@/models/ticket';
import { getCurrentSession, refreshSession } from '@/services/sessionManager';
import { localizeApiErrorMessage } from '@/utils/apiErrorLocalization';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
}

function parseTicketQrEventBlock(block: string): TicketQrToken | Error | null {
  const lines = block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const eventName = lines.find((line) => line.startsWith('event:'))?.replace(/^event:\s*/, '');
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s*/, ''));

  if (dataLines.length === 0) {
    return null;
  }

  try {
    const data = JSON.parse(dataLines.join('\n'));
    if (eventName === 'error') {
      return new Error(
        data.message
          ? localizeApiErrorMessage(data.message)
          : 'Failed to load the live QR token.',
      );
    }

    if (data.token) {
      return data as TicketQrToken;
    }
  } catch {
    // Wait for more chunks if the payload is incomplete.
  }

  return null;
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
    'Accept-Language': getCurrentLocale(),
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
    xhr.setRequestHeader('Accept-Language', getCurrentLocale());
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

      const eventBlocks = buffer.split(/\r?\n\r?\n/);
      buffer = eventBlocks.pop() ?? '';

      for (const block of eventBlocks) {
        const item = parseTicketQrEventBlock(block);
        if (item instanceof Error) {
          settle(() => reject(item));
          return;
        }

        if (item) {
          settle(() => resolve(item));
          return;
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
            errorMessage = localizeApiErrorMessage(errorData.error.message);
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
