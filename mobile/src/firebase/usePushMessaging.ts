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
import { getDeviceInstallationID } from '@/services/deviceInstallation';
import {
  registerPushDevice,
  unregisterPushDevice,
} from '@/services/pushDeviceService';

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
  authToken?: string | null;
  /** Called whenever an FCM token is acquired or rotated (send this to your server). */
  onFcmToken?: (token: string) => void;
};

/** Registers foreground listeners and requests permission + token. Not used on web. */
export function usePushMessaging(options?: PushMessagingOptions) {
  const onFcmTokenRef = useRef(options?.onFcmToken);
  const authTokenRef = useRef(options?.authToken ?? null);
  const previousAuthTokenRef = useRef<string | null>(options?.authToken ?? null);
  const currentFcmTokenRef = useRef<string | null>(null);
  const lastSyncedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    onFcmTokenRef.current = options?.onFcmToken;
  }, [options?.onFcmToken]);

  useEffect(() => {
    authTokenRef.current = options?.authToken ?? null;
  }, [options?.authToken]);

  const syncTokenToBackend = async (fcmToken: string, authToken: string) => {
    const installationID = await getDeviceInstallationID();
    const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
    const syncKey = `${authToken}:${installationID}:${fcmToken}`;
    if (lastSyncedKeyRef.current === syncKey) {
      return;
    }
    await registerPushDevice(
      installationID,
      {
        fcm_token: fcmToken,
        platform,
        device_info: `${Platform.OS} ${Platform.Version}`,
      },
      authToken,
    );
    lastSyncedKeyRef.current = syncKey;
  };

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
        currentFcmTokenRef.current = token;
        onFcmTokenRef.current?.(token);
        const authToken = authTokenRef.current;
        if (authToken) {
          await syncTokenToBackend(token, authToken).catch(() => {});
        }
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

  useEffect(() => {
    const authToken = options?.authToken ?? null;
    const previousAuthToken = previousAuthTokenRef.current;
    previousAuthTokenRef.current = authToken;

    if (authToken && currentFcmTokenRef.current) {
      void syncTokenToBackend(currentFcmTokenRef.current, authToken).catch(() => {});
      return;
    }

    if (!authToken && previousAuthToken) {
      lastSyncedKeyRef.current = null;
      void (async () => {
        const installationID = await getDeviceInstallationID();
        await unregisterPushDevice(installationID, previousAuthToken);
      })().catch(() => {});
    }
  }, [options?.authToken]);
}
