import { useEffect, useRef } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission,
} from '@react-native-firebase/messaging';

async function ensureAndroidPostNotificationsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    return true;
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export type PushMessagingOptions = {
  /** Called whenever an FCM token is acquired or rotated (send this to your server). */
  onFcmToken?: (token: string) => void;
};

/** Registers foreground listeners and requests permission + token. Not used on web. */
export function usePushMessaging(options?: PushMessagingOptions) {
  const onFcmTokenRef = useRef(options?.onFcmToken);
  useEffect(() => {
    onFcmTokenRef.current = options?.onFcmToken;
  }, [options?.onFcmToken]);

  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      return undefined;
    }

    const unsubscribers: Array<() => void> = [];

    (async () => {
      const messaging = getMessaging();

      const notificationsOk = await ensureAndroidPostNotificationsPermission();
      if (!notificationsOk) {
        return;
      }

      const status = await requestPermission(messaging);
      const notificationsAllowed =
        status === AuthorizationStatus.AUTHORIZED ||
        status === AuthorizationStatus.PROVISIONAL ||
        status === AuthorizationStatus.EPHEMERAL;

      if (!notificationsAllowed) {
        return;
      }

      if (Platform.OS === 'ios') {
        await registerDeviceForRemoteMessages(messaging);
      }

      const pushTokenToServer = async () => {
        const token = await getToken(messaging);
        onFcmTokenRef.current?.(token);
      };

      await pushTokenToServer();

      unsubscribers.push(onTokenRefresh(messaging, () => pushTokenToServer()));

      unsubscribers.push(
        onMessage(messaging, (remoteMessage) => {
          const title = remoteMessage.notification?.title ?? 'Notification';
          const body = remoteMessage.notification?.body;
          if (body) {
            Alert.alert(title, body);
          }
        }),
      );

      unsubscribers.push(onNotificationOpenedApp(messaging, () => {}));

      await getInitialNotification(messaging);
    })();

    return () => unsubscribers.forEach((u) => u());
  }, []);
}
