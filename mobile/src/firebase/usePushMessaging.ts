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
import {
  normalizePushNotificationPayload,
  NormalizedPushNotificationPayload,
} from '@/firebase/pushNotificationPayload';

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
  pushNotificationsEnabled?: boolean;
  /** Called whenever an FCM token is acquired or rotated (send this to your server). */
  onFcmToken?: (token: string) => void;
  onNotificationReceived?: (payload: NormalizedPushNotificationPayload) => void;
  onNotificationOpened?: (payload: NormalizedPushNotificationPayload) => void;
};

/** Registers foreground listeners and requests permission + token. Not used on web. */
export function usePushMessaging(options?: PushMessagingOptions) {
  const pushNotificationsEnabled = options?.pushNotificationsEnabled ?? true;
  const onFcmTokenRef = useRef(options?.onFcmToken);
  const onNotificationReceivedRef = useRef(options?.onNotificationReceived);
  const onNotificationOpenedRef = useRef(options?.onNotificationOpened);
  const authTokenRef = useRef(options?.authToken ?? null);
  const previousEffectiveAuthTokenRef = useRef<string | null>(
    pushNotificationsEnabled ? options?.authToken ?? null : null,
  );
  const currentFcmTokenRef = useRef<string | null>(null);
  const lastSyncedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    onFcmTokenRef.current = options?.onFcmToken;
  }, [options?.onFcmToken]);

  useEffect(() => {
    onNotificationReceivedRef.current = options?.onNotificationReceived;
  }, [options?.onNotificationReceived]);

  useEffect(() => {
    onNotificationOpenedRef.current = options?.onNotificationOpened;
  }, [options?.onNotificationOpened]);

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
    if (
      !pushNotificationsEnabled ||
      (Platform.OS !== 'ios' && Platform.OS !== 'android')
    ) {
      return undefined;
    }

    const unsubscribers: Array<() => void> = [];
    let active = true;

    (async () => {
      const messaging = getMessaging();

      const notificationsOk = await ensureAndroidPostNotificationsPermission();
      if (!active || !notificationsOk) {
        return;
      }

      const status = await requestPermission(messaging);
      const notificationsAllowed =
        status === AuthorizationStatus.AUTHORIZED ||
        status === AuthorizationStatus.PROVISIONAL ||
        status === AuthorizationStatus.EPHEMERAL;

      if (!active || !notificationsAllowed) {
        return;
      }

      if (Platform.OS === 'ios') {
        await registerDeviceForRemoteMessages(messaging);
      }

      const pushTokenToServer = async () => {
        const token = await getToken(messaging);
        if (!active) return;
        currentFcmTokenRef.current = token;
        onFcmTokenRef.current?.(token);
        const authToken = authTokenRef.current;
        if (authToken) {
          await syncTokenToBackend(token, authToken).catch(() => {});
        }
      };

      await pushTokenToServer();

      unsubscribers.push(
        onTokenRefresh(messaging, () => {
          void pushTokenToServer();
        }),
      );

      unsubscribers.push(
        onMessage(messaging, (remoteMessage) => {
          const payload = normalizePushNotificationPayload(remoteMessage);
          onNotificationReceivedRef.current?.(payload);

          if (payload.body) {
            Alert.alert(payload.title, payload.body, [
              { text: 'Dismiss', style: 'cancel' },
              {
                text: 'View',
                onPress: () => onNotificationOpenedRef.current?.(payload),
              },
            ]);
          }
        }),
      );

      unsubscribers.push(
        onNotificationOpenedApp(messaging, (remoteMessage) => {
          onNotificationOpenedRef.current?.(
            normalizePushNotificationPayload(remoteMessage),
          );
        }),
      );

      const initialNotification = await getInitialNotification(messaging);
      if (active && initialNotification) {
        onNotificationOpenedRef.current?.(
          normalizePushNotificationPayload(initialNotification),
        );
      }
    })().catch(() => {});

    return () => {
      active = false;
      unsubscribers.forEach((u) => u());
    };
  }, [pushNotificationsEnabled]);

  useEffect(() => {
    const effectiveAuthToken = pushNotificationsEnabled
      ? options?.authToken ?? null
      : null;
    const previousEffectiveAuthToken = previousEffectiveAuthTokenRef.current;
    previousEffectiveAuthTokenRef.current = effectiveAuthToken;

    if (effectiveAuthToken && currentFcmTokenRef.current) {
      void syncTokenToBackend(
        currentFcmTokenRef.current,
        effectiveAuthToken,
      ).catch(() => {});
      return;
    }

    if (!effectiveAuthToken && previousEffectiveAuthToken) {
      lastSyncedKeyRef.current = null;
      void (async () => {
        const installationID = await getDeviceInstallationID();
        await unregisterPushDevice(installationID, previousEffectiveAuthToken);
      })().catch(() => {});
    }
  }, [options?.authToken, pushNotificationsEnabled]);
}
