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

## Project Structure

```
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
