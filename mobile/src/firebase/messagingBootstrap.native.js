import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';

/** Must stay fast; invoked in a headless context on Android. */
setBackgroundMessageHandler(getMessaging(), async () => {});
