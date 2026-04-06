import { Stack, router, usePathname, type Href } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

function AppStack() {
  const { isHydrating, token } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (isHydrating === true) return;

    const isAuthRoute =
      pathname === '/' || pathname === '/register' || pathname === '/forgot-password';
    const isProtectedRoute = !isAuthRoute;

    if (token && isAuthRoute) {
      router.replace('/home' as Href);
      return;
    }

    if (!token && isProtectedRoute) {
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
    <AuthProvider>
      <AppStack />
    </AuthProvider>
  );
}
