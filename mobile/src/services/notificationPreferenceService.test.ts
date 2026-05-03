import * as SecureStore from 'expo-secure-store';
import {
  getPushNotificationsEnabled,
  setPushNotificationsEnabled,
  subscribePushNotificationsEnabled,
} from './notificationPreferenceService';

describe('notificationPreferenceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore as unknown as { __reset: () => void }).__reset();
  });

  it('defaults push notifications to enabled', async () => {
    await expect(getPushNotificationsEnabled()).resolves.toBe(true);
  });

  it('persists disabled push notifications', async () => {
    await setPushNotificationsEnabled(false);

    await expect(getPushNotificationsEnabled()).resolves.toBe(false);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'sem.push-notifications-enabled',
      'false',
    );
  });

  it('notifies subscribers when the preference changes', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribePushNotificationsEnabled(listener);

    await setPushNotificationsEnabled(false);
    unsubscribe();
    await setPushNotificationsEnabled(true);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(false);
  });
});
