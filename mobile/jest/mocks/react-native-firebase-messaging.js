/** Jest stub for modular `@react-native-firebase/messaging` API. */

const unsub = jest.fn();

const messagingStub = {
  requestPermission: jest.fn(() => Promise.resolve(1)),
  getToken: jest.fn(() => Promise.resolve('test-fcm-token')),
  registerDeviceForRemoteMessages: jest.fn(() => Promise.resolve(undefined)),
  onTokenRefresh: jest.fn(() => unsub),
  onMessage: jest.fn(() => unsub),
  onNotificationOpenedApp: jest.fn(() => unsub),
  getInitialNotification: jest.fn(() => Promise.resolve(null)),
};

module.exports = {
  AuthorizationStatus: {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
    EPHEMERAL: 3,
  },
  getMessaging: jest.fn(() => messagingStub),
  requestPermission: (messaging) => messaging.requestPermission(),
  registerDeviceForRemoteMessages: (messaging) =>
    messaging.registerDeviceForRemoteMessages(),
  getToken: (messaging) => messaging.getToken(),
  onTokenRefresh: (messaging, listener) => messaging.onTokenRefresh(listener),
  onMessage: (messaging, listener) => messaging.onMessage(listener),
  onNotificationOpenedApp: (messaging, listener) =>
    messaging.onNotificationOpenedApp(listener),
  getInitialNotification: (messaging) => messaging.getInitialNotification(),
};
