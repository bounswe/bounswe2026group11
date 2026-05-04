import '@/firebase/appFirebase';

import { PushMessagingHost } from '@/components/common/PushMessagingHost';
import { Stack, router, usePathname, type Href } from 'expo-router';
import { useEffect } from 'react';
import { SystemUIHandler } from '@/components/common/SystemUIHandler';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/theme';

const AUTH_ROUTES = new Set(['/', '/register', '/forgot-password']);

function AppStack() {
  const { isHydrating, token } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (isHydrating === true) return;

    const isAuthRoute = AUTH_ROUTES.has(pathname);

    if (token && isAuthRoute) {
      router.replace('/(tabs)/home' as Href);
      return;
    }

    if (!token && !isAuthRoute) {
      router.replace('/' as Href);
    }
  }, [isHydrating, pathname, token]);

  if (isHydrating === true) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SystemUIHandler />
      <AuthProvider>
        <PushMessagingHost />
        <AppStack />
      </AuthProvider>
    </ThemeProvider>
  );
}
