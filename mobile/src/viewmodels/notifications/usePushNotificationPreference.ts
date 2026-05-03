import { useCallback, useEffect, useState } from 'react';
import {
  getPushNotificationsEnabled,
  setPushNotificationsEnabled as persistPushNotificationsEnabled,
  subscribePushNotificationsEnabled,
} from '@/services/notificationPreferenceService';

export interface PushNotificationPreferenceViewModel {
  pushNotificationsEnabled: boolean;
  isHydrating: boolean;
  isSaving: boolean;
  errorMessage: string | null;
  setPushNotificationsEnabled: (enabled: boolean) => Promise<void>;
}

export function usePushNotificationPreference(): PushNotificationPreferenceViewModel {
  const [pushNotificationsEnabled, setPushNotificationsEnabledState] = useState(true);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = subscribePushNotificationsEnabled((enabled) => {
      if (mounted) {
        setPushNotificationsEnabledState(enabled);
      }
    });

    void (async () => {
      try {
        const enabled = await getPushNotificationsEnabled();
        if (!mounted) return;
        setPushNotificationsEnabledState(enabled);
      } catch {
        if (!mounted) return;
        setErrorMessage('Failed to load notification settings.');
      } finally {
        if (mounted) setIsHydrating(false);
      }
    })();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const setPushNotificationsEnabled = useCallback(
    async (enabled: boolean) => {
      const previous = pushNotificationsEnabled;
      setPushNotificationsEnabledState(enabled);
      setIsSaving(true);
      setErrorMessage(null);

      try {
        await persistPushNotificationsEnabled(enabled);
      } catch {
        setPushNotificationsEnabledState(previous);
        setErrorMessage('Failed to update notification settings. Please try again.');
      } finally {
        setIsSaving(false);
      }
    },
    [pushNotificationsEnabled],
  );

  return {
    pushNotificationsEnabled,
    isHydrating,
    isSaving,
    errorMessage,
    setPushNotificationsEnabled,
  };
}
