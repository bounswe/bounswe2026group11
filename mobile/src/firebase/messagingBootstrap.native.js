import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import { normalizePushNotificationPayload } from './pushNotificationPayload';

/** Must stay fast; invoked in a headless context on Android. */
setBackgroundMessageHandler(getMessaging(), async (remoteMessage) => {
  const payload = normalizePushNotificationPayload(remoteMessage);

  if (__DEV__) {
    console.log(
      '[FCM background payload]',
      payload.notification_id ?? payload.event_id ?? payload.title,
    );
  }
});
