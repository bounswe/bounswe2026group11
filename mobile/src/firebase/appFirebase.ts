/**
 * Firebase App (native) — requires `firebase/google-services.json` and
 * `firebase/GoogleService-Info.plist` from the Firebase Console (see mobile/app.json).
 */
import firebase from '@react-native-firebase/app';

export type { FirebaseApp } from '@react-native-firebase/app';

export function getFirebaseApp() {
  return firebase.app();
}
