import type { AuthSessionResponse, StoredAuthSession } from '@/models/auth';
import { API_BASE_URL } from '@/config/apiBaseUrl';
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from '@/services/sessionStorage';

type SessionListener = (session: StoredAuthSession | null) => void;

let currentSession: StoredAuthSession | null = null;
let hydratePromise: Promise<StoredAuthSession | null> | null = null;
let refreshPromise: Promise<StoredAuthSession> | null = null;
const listeners = new Set<SessionListener>();

function notifyListeners() {
  for (const listener of listeners) {
    listener(currentSession);
  }
}

function mapAuthSession(response: AuthSessionResponse): StoredAuthSession {
  return {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    user: response.user,
  };
}

function isTerminalRefreshError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: unknown }).status === 401
  );
}

async function refreshSessionRequest(
  refreshToken: string,
): Promise<AuthSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const error = new Error(
      body?.error?.message ?? 'Could not refresh the session.',
    ) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }

  return response.json();
}

export async function hydrateSession(): Promise<StoredAuthSession | null> {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      currentSession = await readStoredSession();
      notifyListeners();
      return currentSession;
    })();
  }

  return hydratePromise;
}

export function getCurrentSession(): StoredAuthSession | null {
  return currentSession;
}

export function subscribeToSession(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function setSession(session: StoredAuthSession): Promise<void> {
  await writeStoredSession(session);
  currentSession = session;
  notifyListeners();
}

export async function setSessionFromAuthResponse(
  response: AuthSessionResponse,
): Promise<void> {
  await setSession(mapAuthSession(response));
}

export async function clearSession(): Promise<void> {
  refreshPromise = null;
  await clearStoredSession();
  currentSession = null;
  notifyListeners();
}

export async function refreshSession(): Promise<StoredAuthSession> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const session = currentSession ?? (await hydrateSession());
      if (!session?.refresh_token) {
        throw new Error('No refresh token available');
      }

      try {
        const refreshed = await refreshSessionRequest(session.refresh_token);
        const nextSession = mapAuthSession(refreshed);
        await writeStoredSession(nextSession);
        currentSession = nextSession;
        notifyListeners();
        return nextSession;
      } catch (error) {
        if (isTerminalRefreshError(error)) {
          await clearSession();
        }
        throw error;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}
