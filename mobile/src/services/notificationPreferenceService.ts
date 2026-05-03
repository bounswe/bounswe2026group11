import * as SecureStore from 'expo-secure-store';

const PUSH_NOTIFICATIONS_ENABLED_KEY = 'sem:push-notifications-enabled';

type PushPreferenceListener = (enabled: boolean) => void;

const listeners = new Set<PushPreferenceListener>();

function emitPushPreference(enabled: boolean) {
  listeners.forEach((listener) => listener(enabled));
}

export async function getPushNotificationsEnabled(): Promise<boolean> {
  const storedValue = await SecureStore.getItemAsync(PUSH_NOTIFICATIONS_ENABLED_KEY);
  return storedValue !== 'false';
}

export async function setPushNotificationsEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(
    PUSH_NOTIFICATIONS_ENABLED_KEY,
    enabled ? 'true' : 'false',
  );
  emitPushPreference(enabled);
}

export function subscribePushNotificationsEnabled(
  listener: PushPreferenceListener,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
