import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { setTokenRefreshManager } from '@/services/api';
import { profileService } from '@/services/profileService';
import type { UserRole } from '@/models/auth';

const STORAGE_KEY_TOKEN = 'sem_access_token';
const STORAGE_KEY_REFRESH = 'sem_refresh_token';
const STORAGE_KEY_USERNAME = 'sem_username';
const STORAGE_KEY_AVATAR_URL = 'sem_avatar_url';
const STORAGE_KEY_DISPLAY_NAME = 'sem_display_name';
const STORAGE_KEY_ROLE = 'sem_role';

function normalizeRole(value: string | null | undefined): UserRole | null {
  return value === 'ADMIN' || value === 'USER' ? value : null;
}

function readRoleFromAccessToken(accessToken: string): UserRole | null {
  const payload = accessToken.split('.')[1];
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(window.atob(padded)) as { role?: string };
    return normalizeRole(decoded.role);
  } catch {
    return null;
  }
}

export interface ProfileSummary {
  avatarUrl: string | null;
  displayName: string | null;
}

interface AuthContextType {
  token: string | null;
  refreshToken: string | null;
  username: string | null;
  role: UserRole | null;
  avatarUrl: string | null;
  displayName: string | null;
  isLoading: boolean;
  setSession: (accessToken: string, refreshToken: string, username: string, role?: UserRole) => void;
  setProfileSummary: (data: ProfileSummary) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
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
      const storedRole = normalizeRole(localStorage.getItem(STORAGE_KEY_ROLE)) ?? readRoleFromAccessToken(storedToken) ?? 'USER';
      setRole(storedRole);
      localStorage.setItem(STORAGE_KEY_ROLE, storedRole);
      const storedAvatar = localStorage.getItem(STORAGE_KEY_AVATAR_URL);
      const storedDisplayName = localStorage.getItem(STORAGE_KEY_DISPLAY_NAME);
      setAvatarUrl(storedAvatar);
      setDisplayName(storedDisplayName);
    }
    setIsLoading(false);
  }, []);

  const setSession = useCallback(
    (accessToken: string, refresh: string, user: string, nextRole: UserRole = 'USER') => {
      localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
      localStorage.setItem(STORAGE_KEY_REFRESH, refresh);
      localStorage.setItem(STORAGE_KEY_USERNAME, user);
      localStorage.setItem(STORAGE_KEY_ROLE, nextRole);
      localStorage.removeItem(STORAGE_KEY_AVATAR_URL);
      localStorage.removeItem(STORAGE_KEY_DISPLAY_NAME);
      setToken(accessToken);
      setRefreshToken(refresh);
      setUsername(user);
      setRole(nextRole);
      setAvatarUrl(null);
      setDisplayName(null);
    },
    [],
  );

  const clearAuth = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_REFRESH);
    localStorage.removeItem(STORAGE_KEY_USERNAME);
    localStorage.removeItem(STORAGE_KEY_ROLE);
    localStorage.removeItem(STORAGE_KEY_AVATAR_URL);
    localStorage.removeItem(STORAGE_KEY_DISPLAY_NAME);
    setToken(null);
    setRefreshToken(null);
    setUsername(null);
    setRole(null);
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
      onRefreshSuccess: (accessToken, newRefreshToken, newUsername, newRole) => {
        setSession(accessToken, newRefreshToken, newUsername, newRole);
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
        role,
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
