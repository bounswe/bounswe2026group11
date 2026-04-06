import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { setTokenRefreshManager } from '@/services/api';
import { profileService } from '@/services/profileService';

const STORAGE_KEY_TOKEN = 'sem_access_token';
const STORAGE_KEY_REFRESH = 'sem_refresh_token';
const STORAGE_KEY_USERNAME = 'sem_username';
const STORAGE_KEY_AVATAR_URL = 'sem_avatar_url';
const STORAGE_KEY_DISPLAY_NAME = 'sem_display_name';

export interface ProfileSummary {
  avatarUrl: string | null;
  displayName: string | null;
}

interface AuthContextType {
  token: string | null;
  refreshToken: string | null;
  username: string | null;
  avatarUrl: string | null;
  displayName: string | null;
  isLoading: boolean;
  setSession: (accessToken: string, refreshToken: string, username: string) => void;
  setProfileSummary: (data: ProfileSummary) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setProfileSummary = useCallback((data: ProfileSummary) => {
    setAvatarUrl(data.avatarUrl);
    setDisplayName(data.displayName);
    if (data.avatarUrl) {
      localStorage.setItem(STORAGE_KEY_AVATAR_URL, data.avatarUrl);
    } else {
      localStorage.removeItem(STORAGE_KEY_AVATAR_URL);
    }
    if (data.displayName) {
      localStorage.setItem(STORAGE_KEY_DISPLAY_NAME, data.displayName);
    } else {
      localStorage.removeItem(STORAGE_KEY_DISPLAY_NAME);
    }
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    const storedRefresh = localStorage.getItem(STORAGE_KEY_REFRESH);
    const storedUsername = localStorage.getItem(STORAGE_KEY_USERNAME);
    if (storedToken && storedRefresh) {
      setToken(storedToken);
      setRefreshToken(storedRefresh);
      setUsername(storedUsername);
      const storedAvatar = localStorage.getItem(STORAGE_KEY_AVATAR_URL);
      const storedDisplayName = localStorage.getItem(STORAGE_KEY_DISPLAY_NAME);
      setAvatarUrl(storedAvatar);
      setDisplayName(storedDisplayName);
    }
    setIsLoading(false);
  }, []);

  const setSession = useCallback(
    (accessToken: string, refresh: string, user: string) => {
      localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
      localStorage.setItem(STORAGE_KEY_REFRESH, refresh);
      localStorage.setItem(STORAGE_KEY_USERNAME, user);
      localStorage.removeItem(STORAGE_KEY_AVATAR_URL);
      localStorage.removeItem(STORAGE_KEY_DISPLAY_NAME);
      setToken(accessToken);
      setRefreshToken(refresh);
      setUsername(user);
      setAvatarUrl(null);
      setDisplayName(null);
    },
    [],
  );

  const clearAuth = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_REFRESH);
    localStorage.removeItem(STORAGE_KEY_USERNAME);
    localStorage.removeItem(STORAGE_KEY_AVATAR_URL);
    localStorage.removeItem(STORAGE_KEY_DISPLAY_NAME);
    setToken(null);
    setRefreshToken(null);
    setUsername(null);
    setAvatarUrl(null);
    setDisplayName(null);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    profileService
      .getMyProfile(token)
      .then((data) => {
        if (!cancelled) {
          setProfileSummary({
            avatarUrl: data.avatar_url ?? null,
            displayName: data.display_name ?? null,
          });
        }
      })
      .catch(() => {
        /* keep cached profile summary from localStorage */
      });
    return () => {
      cancelled = true;
    };
  }, [token, setProfileSummary]);

  useEffect(() => {
    setTokenRefreshManager({
      getRefreshToken: () => localStorage.getItem(STORAGE_KEY_REFRESH),
      onRefreshSuccess: (accessToken, newRefreshToken, newUsername) => {
        setSession(accessToken, newRefreshToken, newUsername);
      },
      onRefreshFailure: clearAuth,
    });

    return () => {
      setTokenRefreshManager(null);
    };
  }, [setSession, clearAuth]);

  return (
    <AuthContext.Provider
      value={{
        token,
        refreshToken,
        username,
        avatarUrl,
        displayName,
        isLoading,
        setSession,
        setProfileSummary,
        clearAuth,
      }}
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
