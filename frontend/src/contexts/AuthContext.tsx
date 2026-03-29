import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const STORAGE_KEY_TOKEN = 'sem_access_token';
const STORAGE_KEY_REFRESH = 'sem_refresh_token';
const STORAGE_KEY_USERNAME = 'sem_username';

interface AuthContextType {
  token: string | null;
  refreshToken: string | null;
  username: string | null;
  isLoading: boolean;
  setSession: (accessToken: string, refreshToken: string, username: string) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    const storedRefresh = localStorage.getItem(STORAGE_KEY_REFRESH);
    const storedUsername = localStorage.getItem(STORAGE_KEY_USERNAME);
    if (storedToken && storedRefresh) {
      setToken(storedToken);
      setRefreshToken(storedRefresh);
      setUsername(storedUsername);
    }
    setIsLoading(false);
  }, []);

  const setSession = useCallback(
    (accessToken: string, refresh: string, user: string) => {
      localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
      localStorage.setItem(STORAGE_KEY_REFRESH, refresh);
      localStorage.setItem(STORAGE_KEY_USERNAME, user);
      setToken(accessToken);
      setRefreshToken(refresh);
      setUsername(user);
    },
    [],
  );

  const clearAuth = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_REFRESH);
    localStorage.removeItem(STORAGE_KEY_USERNAME);
    setToken(null);
    setRefreshToken(null);
    setUsername(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, refreshToken, username, isLoading, setSession, clearAuth }}
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
