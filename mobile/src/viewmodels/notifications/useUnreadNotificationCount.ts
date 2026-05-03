import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUnreadNotificationCount } from '@/services/notificationService';

export interface UnreadNotificationCountViewModel {
  unreadCount: number;
  refresh: () => Promise<void>;
}

export function useUnreadNotificationCount(): UnreadNotificationCountViewModel {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!token) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await getUnreadNotificationCount(token);
      setUnreadCount(response.unread_count);
    } catch {
      // silently ignore — badge is best-effort
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { unreadCount, refresh };
}
