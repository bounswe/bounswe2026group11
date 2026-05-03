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

export async function getTicketQrTokenOnce(
  ticketId: string,
  coords: { lat: number; lon: number },
  token: string,
): Promise<TicketQrToken> {
  const response = await ticketRequest(
    `/me/tickets/${ticketId}/qr-stream?lat=${encodeURIComponent(String(coords.lat))}&lon=${encodeURIComponent(String(coords.lon))}`,
    {
      method: 'GET',
      headers: {
        'X-Client-Surface': 'MOBILE',
        Accept: 'text/event-stream',
      },
    },
    { token, requiresAuth: true },
  );

  const reader = response.body?.getReader?.();
  if (!reader) {
    throw new Error('Live QR streaming is not supported on this device build.');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const payload = trimmed.replace(/^data:\s*/, '');
      try {
        await reader.cancel();
      } catch {
        // Ignore cancellation failures after the first payload arrives.
      }
      return JSON.parse(payload) as TicketQrToken;
    }
  }

  throw new Error('No QR token was received from the server.');
}
