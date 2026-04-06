import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { router, type Href } from 'expo-router';
import { StoredAuthSession, UserSummary } from '@/models/auth';
import {
  clearSession as clearStoredSession,
  hydrateSession,
  setSession as persistSession,
  subscribeToSession,
} from '@/services/sessionManager';

interface AuthContextType {
  token: string | null;
  refreshToken: string | null;
  user: UserSummary | null;
  isHydrating?: boolean;
  setSession: (
    accessToken: string,
    refreshToken: string,
    user: UserSummary,
  ) => Promise<void>;
  clearAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserSummary | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const previousSessionRef = useRef<StoredAuthSession | null>(null);

  const applySession = useCallback((session: StoredAuthSession | null) => {
    setToken(session?.access_token ?? null);
    setRefreshToken(session?.refresh_token ?? null);
    setUser(session?.user ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = subscribeToSession((session) => {
      if (!mounted) return;

      const previousSession = previousSessionRef.current;
      previousSessionRef.current = session;
      applySession(session);

      if (!isHydrating && previousSession && !session) {
        router.replace('/' as Href);
      }
    });

    void (async () => {
      const session = await hydrateSession();
      if (!mounted) return;
      previousSessionRef.current = session;
      applySession(session);
      setIsHydrating(false);
    })();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [applySession, isHydrating]);

  const setSession = useCallback(
    async (accessToken: string, refresh: string, userSummary: UserSummary) => {
      await persistSession({
        access_token: accessToken,
        refresh_token: refresh,
        user: userSummary,
      });
    },
    [],
  );

  const clearAuth = useCallback(() => {
    return clearStoredSession();
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, refreshToken, user, isHydrating, setSession, clearAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
