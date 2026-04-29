import { usePushMessaging } from '@/firebase/usePushMessaging';

/** Mount once under providers to enable FCM token + foreground alerts. */
export function PushMessagingHost() {
  usePushMessaging(
    __DEV__
      ? {
          onFcmToken: (token) => {
            console.log('[FCM] (prefix for quick scan)', `${token.slice(0, 40)}…`);
            console.log('[FCM token — copy full line for Firebase test]', token);
          },
        }
      : undefined,
  );

  return null;
}
