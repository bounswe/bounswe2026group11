import { Platform } from 'react-native';

const PRODUCTION_API_BASE_URL = 'https://www.socialeventmapper.com/api';

/**
 * Base URL for the backend API (includes `/api` prefix).
 *
 * **Docker Compose (local):** nginx listens on the host at port **80**, so paths are
 * `http://<host>/api/...` — not `:8000` (that is only inside the Docker network).
 *
 * | Where you run the app | Default host |
 * |------------------------|--------------|
 * | iOS Simulator | `localhost` |
 * | Android Emulator | `10.0.2.2` (special alias to your Mac) |
 * | Physical phone (Expo Go) | Set `EXPO_PUBLIC_API_BASE_URL` to `http://<your-computer-LAN-IP>/api` |
 *
 * Create `mobile/.env` from `.env.example` and restart Metro after changing.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }

  if (process.env.EXPO_PUBLIC_APP_ENV === 'production') {
    return PRODUCTION_API_BASE_URL;
  }

  const host =
    Platform.OS === 'android'
      ? '10.0.2.2' // Android emulator → host machine (not localhost)
      : 'localhost';

  return `http://${host}/api`;
}

/** Resolved once at startup; use `EXPO_PUBLIC_API_BASE_URL` for local overrides. */
export const API_BASE_URL = getApiBaseUrl();
