import { API_BASE_URL } from '@/config/apiBaseUrl';
import { ErrorResponse } from '@/models/auth';
import {
  getCurrentSession,
  refreshSession,
} from '@/services/sessionManager';

export const BASE_URL = API_BASE_URL;

export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, string>;

  constructor(status: number, body: ErrorResponse) {
    super(body.error.message);
    this.name = 'ApiError';
    this.code = body.error.code;
    this.status = status;
    this.details = body.error.details;
  }
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

async function requestJson<T>(
  endpoint: string,
  init: RequestInit,
  options?: { token?: string; requiresAuth?: boolean; hasRetried?: boolean },
): Promise<T> {
  const activeToken =
    options?.requiresAuth
      ? getCurrentSession()?.access_token ?? options?.token
      : undefined;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };

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
    return requestJson<T>(endpoint, init, {
      ...options,
      token: refreshedSession.access_token,
      hasRetried: true,
    });
  }

  if (!response.ok) {
    const errorBody = await parseErrorResponse(response);
    throw new ApiError(response.status, errorBody);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  return requestJson<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  return requestJson<T>(endpoint, {
    method: 'GET',
  });
}

export async function apiGetAuth<T>(endpoint: string, token: string): Promise<T> {
  return requestJson<T>(
    endpoint,
    {
      method: 'GET',
    },
    { token, requiresAuth: true },
  );
}

export async function apiPostAuth<T>(endpoint: string, body: unknown, token: string): Promise<T> {
  return requestJson<T>(
    endpoint,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    { token, requiresAuth: true },
  );
}

export async function apiDeleteAuth<T>(endpoint: string, token: string): Promise<T> {
  return requestJson<T>(
    endpoint,
    {
      method: 'DELETE',
    },
    { token, requiresAuth: true },
  );
}

export async function apiPatchAuth<T>(endpoint: string, body: unknown, token: string): Promise<T> {
  return requestJson<T>(
    endpoint,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
    { token, requiresAuth: true },
  );
}
