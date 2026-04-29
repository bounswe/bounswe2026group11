// FCM background handler must register before Expo Router initializes.
import './src/firebase/messagingBootstrap';
import 'expo-router/entry';
