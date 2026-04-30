import { useState, useCallback } from 'react';
import { logout } from '@/services/authService';
import { ApiError } from '@/services/api';
import { getDeviceInstallationID } from '@/services/deviceInstallation';

export interface UseLogoutResult {
  isLoggingOut: boolean;
  logoutError: string | null;
  handleLogout: () => Promise<void>;
}

export function useLogoutViewModel(
  refreshToken: string | null,
  onLoggedOut: () => void,
): UseLogoutResult {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleLogout = useCallback(async () => {
    setLogoutError(null);

    if (!refreshToken) {
      onLoggedOut();
      return;
    }

    setIsLoggingOut(true);
    try {
      const deviceInstallationID = await getDeviceInstallationID();
      await logout({
        refresh_token: refreshToken,
        device_installation_id: deviceInstallationID,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Refresh token already invalid on server; still clear local session.
      } else {
        const message =
          err instanceof ApiError
            ? err.message
            : 'Could not reach the server. Please try again.';
        setLogoutError(message);
        setIsLoggingOut(false);
        return;
      }
    }

    onLoggedOut();
    setIsLoggingOut(false);
  }, [refreshToken, onLoggedOut]);

  return { isLoggingOut, logoutError, handleLogout };
}
