# Mobile App

React Native app built with [Expo](https://expo.dev) and [Expo Router](https://docs.expo.dev/router/introduction/).

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Expo Go](https://expo.dev/go) app on your phone (iOS / Android)

## Getting Started

```bash
cd mobile
npm install
npx expo start
```

This starts the Metro bundler. You can then:

- Press `i` to open in iOS Simulator (requires Xcode)
- Press `a` to open in Android Emulator (requires Android Studio)

### API URL (Docker backend on your machine)

With **`docker compose -f deploy/docker-compose.local.yml up`**, nginx exposes the API at **`http://<host>/api`** (port **80**).

The app picks a default host automatically:

| Where you run the app | Default API base |
|------------------------|------------------|
| **iOS Simulator** | `http://localhost/api` |
| **Android Emulator** | `http://10.0.2.2/api` (maps to your Mac) |
| **Physical phone (Expo Go)** | Set `EXPO_PUBLIC_API_BASE_URL` — `localhost` is the phone, not your computer |

For a **real device**, copy `mobile/.env.example` to `mobile/.env` and set your computer’s LAN IP, e.g.:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42/api
```

Restart Metro after editing `.env`.

### Android Google Maps key

Android uses `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` during Expo prebuild. The
key must have Maps SDK for Android enabled and should be restricted in Google
Cloud Console by:

- package name: `com.bounswe2026group11.socialeventmapper`
- certificate SHA-1: the release keystore certificate SHA-1 used for APK signing

## Android APK

The repository includes a GitHub Actions workflow at [`../.github/workflows/mobile-apk.yml`](../.github/workflows/mobile-apk.yml) that builds an Android APK:

- when `mobile/**` changes are pushed to `main`
- on manual `workflow_dispatch`
- when a GitHub release is published

Behavior:

- matching `main` pushes upload the APK as a workflow artifact
- release runs also attach the APK to the GitHub Release page

The workflow builds an installable Android release APK by generating the Android project in CI with Expo prebuild, restoring the release signing keystore from GitHub Secrets, and then running Gradle `assembleRelease`.

Required GitHub Secrets:

- `MOBILE_GOOGLE_MAPS_ANDROID_API_KEY`
- `ANDROID_RELEASE_KEYSTORE_BASE64`
- `ANDROID_RELEASE_KEYSTORE_PASSWORD`
- `ANDROID_RELEASE_KEY_ALIAS`
- `ANDROID_RELEASE_KEY_PASSWORD`

The workflow sets `EXPO_PUBLIC_APP_ENV=production`, so the APK uses the
production API URL defined in `src/config/apiBaseUrl.ts`.

### Local APK build

You need a **local Android SDK** (for example Android Studio installs one). Gradle looks for it via **`ANDROID_HOME`** (or **`ANDROID_SDK_ROOT`**) or **`android/local.properties`**.

**macOS (typical Android Studio path):** `~/Library/Android/sdk`  
**Linux:** often `~/Android/Sdk`

Example session (after `expo prebuild` creates `android/`):

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"   # Linux: adjust path
cd mobile
npm install
npx expo prebuild --platform android --clean
# Gradle 9 from the template can fail with JvmVendorSpec / AGP; this stack needs Gradle >= 8.13. Pin to 8.13 (same as CI):
sed -i '' 's|gradle-[0-9.]*-bin.zip|gradle-8.13-bin.zip|g' android/gradle/wrapper/gradle-wrapper.properties
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android
./gradlew assembleRelease
```

On Linux, use `sed -i` without the empty `''` argument.

For a locally signed release build, append these values to
`android/gradle.properties` after prebuild:

```properties
SEM_RELEASE_STORE_FILE=release.keystore
SEM_RELEASE_STORE_PASSWORD=...
SEM_RELEASE_KEY_ALIAS=...
SEM_RELEASE_KEY_PASSWORD=...
```

Place `release.keystore` in `mobile/android/app/`. Without those properties,
the local release build falls back to the generated debug keystore.

The `android/` folder (including `local.properties`) is gitignored; do not commit machine-specific SDK paths.

Expected output:

```text
mobile/android/app/build/outputs/apk/release/app-release.apk
```

## Project Structure

```text
mobile/
├── src/
│   └── app/           # Screens (file-based routing)
│       ├── _layout.tsx # Root layout
│       └── index.tsx   # Home screen (/)
├── app.json           # Expo config
├── package.json
└── tsconfig.json
```

## Path Aliases

Use `@/` to import from `src/`:

```tsx
import { MyComponent } from '@/components/MyComponent';
```

## Important Notes

- **Do not use `npx expo run:ios` or `npx expo run:android`** for native builds if your repo path contains spaces. Use `npx expo start` with Expo Go instead.
- The `.expo/` and `node_modules/` directories are gitignored — always run `npm install` after cloning.
