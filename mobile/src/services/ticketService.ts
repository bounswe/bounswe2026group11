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

export function getTicketQrTokenOnce(
  ticketId: string,
  coords: { lat: number; lon: number },
  token: string,
): Promise<TicketQrToken> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${BASE_URL}/me/tickets/${ticketId}/qr-stream?lat=${encodeURIComponent(String(coords.lat))}&lon=${encodeURIComponent(String(coords.lon))}`;

    xhr.open('GET', url, true);
    xhr.setRequestHeader('X-Client-Surface', 'MOBILE');
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    let resolved = false;

    xhr.onprogress = () => {
      if (resolved) return;
      const responseText = xhr.responseText;
      if (!responseText) return;

      const lines = responseText.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const payload = trimmed.replace(/^data:\s*/, '');
          try {
            const data = JSON.parse(payload) as Record<string, unknown>;
            if (data.message && !data.token) {
              resolved = true;
              reject(new Error(String(data.message)));
              xhr.abort();
              return;
            }
            resolved = true;
            resolve(data as unknown as TicketQrToken);
            xhr.abort();
            return;
          } catch {
            // Wait for full chunk to arrive
          }
        }
      }
    };

    xhr.onerror = () => {
      if (!resolved) {
        resolved = true;
        reject(new Error('Network request failed'));
      }
    };

    xhr.onload = () => {
      if (resolved) return;
      resolved = true;
      if (xhr.status >= 400) {
        try {
          const body = JSON.parse(xhr.responseText) as ErrorResponse;
          reject(new Error(body.error?.message || `Error ${xhr.status}`));
        } catch {
          reject(new Error(`Failed to get QR token (HTTP ${xhr.status})`));
        }
      } else {
        reject(new Error('No QR token was received from the server.'));
      }
    };

    xhr.send();
  });
}
