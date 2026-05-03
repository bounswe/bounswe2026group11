import { usePushMessaging } from '@/firebase/usePushMessaging';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotificationPreference } from '@/viewmodels/notifications/usePushNotificationPreference';
import { resolveNotificationRoute } from '@/utils/notificationRouting';
import { router, type Href } from 'expo-router';
import { useCallback } from 'react';

/** Mount once under providers to enable FCM token + foreground alerts. */
export function PushMessagingHost() {
  const { token, isHydrating } = useAuth();
  const notificationSettings = usePushNotificationPreference();
  const handleNotificationOpened = useCallback(
    (payload: {
      event_id: string | null;
      deep_link: string | null;
      data: Record<string, string>;
    }) => {
      const route = resolveNotificationRoute(payload);
      router.push((route ?? '/notifications') as Href);
    },
    [],
  );

  usePushMessaging({
    authToken: isHydrating ? null : token,
    pushNotificationsEnabled:
      !notificationSettings.isHydrating &&
      notificationSettings.pushNotificationsEnabled,
    onNotificationOpened: handleNotificationOpened,
    onFcmToken: __DEV__
      ? (fcmToken) => {
          console.log('[FCM] (prefix for quick scan)', `${fcmToken.slice(0, 40)}…`);
          console.log('[FCM token — copy full line for Firebase test]', fcmToken);
        }
      : undefined,
  });

  return null;
}
