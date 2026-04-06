import { API_BASE_URL } from '@/config/api';
import { AuthSessionResponse, ErrorResponse } from '@/models/auth';

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

async function handleErrorResponse(response: Response): Promise<never> {
  try {
    const errorBody: ErrorResponse = await response.json();
    throw new ApiError(response.status, errorBody);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(response.status, {
      error: { code: 'network_error', message: `Request failed (${response.status})` },
    });
  }
}

// --- Token refresh manager ---

interface TokenRefreshManager {
  getRefreshToken: () => string | null;
  onRefreshSuccess: (accessToken: string, refreshToken: string, username: string) => void;
  onRefreshFailure: () => void;
}

let tokenRefreshManager: TokenRefreshManager | null = null;
let pendingRefresh: Promise<string> | null = null;

export function setTokenRefreshManager(manager: TokenRefreshManager | null): void {
  tokenRefreshManager = manager;
}

async function attemptTokenRefresh(): Promise<string> {
  if (pendingRefresh) return pendingRefresh;

  const doRefresh = async (): Promise<string> => {
    const refreshToken = tokenRefreshManager?.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token available');

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      tokenRefreshManager?.onRefreshFailure();
      await handleErrorResponse(response);
    }

    const session: AuthSessionResponse = await response.json();
    tokenRefreshManager?.onRefreshSuccess(
      session.access_token,
      session.refresh_token,
      session.user.username,
    );
    return session.access_token;
  };

  pendingRefresh = doRefresh().finally(() => {
    pendingRefresh = null;
  });

  return pendingRefresh;
}

// --- Public API helpers ---

export async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    await handleErrorResponse(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    await handleErrorResponse(response);
  }

  return response.json();
}

// --- Authenticated API helpers (with silent token refresh on 401) ---

async function fetchWithAuth(
  method: string,
  endpoint: string,
  token: string,
  body?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);

  return fetch(`${API_BASE_URL}${endpoint}`, init);
}

async function executeWithRefresh<T>(
  method: string,
  endpoint: string,
  token: string,
  body?: unknown,
): Promise<T> {
  let response = await fetchWithAuth(method, endpoint, token, body);

  if (response.status === 401 && tokenRefreshManager) {
    const newToken = await attemptTokenRefresh();
    response = await fetchWithAuth(method, endpoint, newToken, body);
  }

  if (!response.ok) {
    await handleErrorResponse(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export function apiGetAuth<T>(endpoint: string, token: string): Promise<T> {
  return executeWithRefresh<T>('GET', endpoint, token);
}

export function apiPostAuth<T>(endpoint: string, body: unknown, token: string): Promise<T> {
  return executeWithRefresh<T>('POST', endpoint, token, body);
}

export function apiPatchAuth<T>(endpoint: string, body: unknown, token: string): Promise<T> {
  return executeWithRefresh<T>('PATCH', endpoint, token, body);
}

export function apiPutAuth<T>(endpoint: string, body: unknown, token: string): Promise<T> {
  return executeWithRefresh<T>('PUT', endpoint, token, body);
}

export function apiDeleteAuth<T>(endpoint: string, token: string): Promise<T> {
  return executeWithRefresh<T>('DELETE', endpoint, token);
}
