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
