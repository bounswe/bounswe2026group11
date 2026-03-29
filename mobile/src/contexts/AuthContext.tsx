import React, { createContext, useContext, useState, useCallback } from 'react';
import { UserSummary } from '@/models/auth';

interface AuthContextType {
  token: string | null;
  refreshToken: string | null;
  user: UserSummary | null;
  setSession: (accessToken: string, refreshToken: string, user: UserSummary) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserSummary | null>(null);

  const setSession = useCallback(
    (accessToken: string, refresh: string, userSummary: UserSummary) => {
      setToken(accessToken);
      setRefreshToken(refresh);
      setUser(userSummary);
    },
    [],
  );

  const clearAuth = useCallback(() => {
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, refreshToken, user, setSession, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
