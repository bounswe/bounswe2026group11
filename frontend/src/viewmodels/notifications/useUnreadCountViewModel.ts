import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUnreadNotificationCount } from '@/services/notificationService';

const POLL_INTERVAL_MS = 60_000;

export interface UnreadCountViewModel {
  unreadCount: number;
  refresh: () => Promise<void>;
}

export function useUnreadCountViewModel(): UnreadCountViewModel {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!token) {
      setUnreadCount(0);
      return;
    }
    try {
      const response = await getUnreadNotificationCount(token);
      if (isMountedRef.current) {
        setUnreadCount(response.unread_count);
      }
    } catch {
      // Best-effort polling; silently ignore transient failures
    }
  }, [token]);

  useEffect(() => {
    refresh();
    if (!token) return;
    const id = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refresh, token]);

  return { unreadCount, refresh };
}
