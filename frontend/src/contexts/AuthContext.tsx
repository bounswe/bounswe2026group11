import { createContext, useContext, useState, useCallback } from 'react';

interface AuthContextType {
  token: string | null;
  refreshToken: string | null;
  username: string | null;
  setSession: (accessToken: string, refreshToken: string, username: string) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  const setSession = useCallback(
    (accessToken: string, refresh: string, user: string) => {
      setToken(accessToken);
      setRefreshToken(refresh);
      setUsername(user);
    },
    [],
  );

  const clearAuth = useCallback(() => {
    setToken(null);
    setRefreshToken(null);
    setUsername(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, refreshToken, username, setSession, clearAuth }}
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
