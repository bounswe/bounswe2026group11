import { Stack, router, usePathname, type Href } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import SemSplashScreen from '@/views/splash/SemSplashScreen';

SplashScreen.preventAutoHideAsync();

const AUTH_ROUTES = new Set(['/', '/register', '/forgot-password']);

function AppStack() {
  const { isHydrating, token } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (isHydrating) return;
    SplashScreen.hideAsync();
  }, [isHydrating]);

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
    return <SemSplashScreen />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppStack />
    </AuthProvider>
  );
}
