import * as SecureStore from 'expo-secure-store';
import type { StoredAuthSession } from '@/models/auth';

const AUTH_SESSION_KEY = 'auth_session';

export async function readStoredSession(): Promise<StoredAuthSession | null> {
  const raw = await SecureStore.getItemAsync(AUTH_SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredAuthSession;
    if (
      parsed &&
      typeof parsed.access_token === 'string' &&
      typeof parsed.refresh_token === 'string' &&
      parsed.user &&
      typeof parsed.user.id === 'string'
    ) {
      return parsed;
    }
  } catch {
    // Corrupted session blobs should not block app startup.
  }

  await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
  return null;
}

export function writeStoredSession(session: StoredAuthSession): Promise<void> {
  return SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession(): Promise<void> {
  return SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
}
