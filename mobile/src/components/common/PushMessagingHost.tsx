import { usePushMessaging } from '@/firebase/usePushMessaging';
import { useAuth } from '@/contexts/AuthContext';

/** Mount once under providers to enable FCM token + foreground alerts. */
export function PushMessagingHost() {
  const { token, isHydrating } = useAuth();
  usePushMessaging({
    authToken: isHydrating ? null : token,
    onFcmToken: __DEV__
      ? (fcmToken) => {
          console.log('[FCM] (prefix for quick scan)', `${fcmToken.slice(0, 40)}…`);
          console.log('[FCM token — copy full line for Firebase test]', fcmToken);
        }
      : undefined,
  });

  return null;
}
