// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUnreadCountViewModel } from './useUnreadCountViewModel';
import {
  emitUnreadCountDelta,
  emitUnreadCountValue,
} from '@/utils/notificationUnreadEvents';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'access-token' }),
}));

vi.mock('@/services/notificationService', () => ({
  getUnreadNotificationCount: vi.fn(),
}));

import { getUnreadNotificationCount } from '@/services/notificationService';

const mockGetUnreadNotificationCount = getUnreadNotificationCount as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUnreadNotificationCount.mockResolvedValue({ unread_count: 2 });
});

describe('useUnreadCountViewModel', () => {
  it('applies immediate unread count updates from notification interactions', async () => {
    const { result } = renderHook(() => useUnreadCountViewModel());

    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    emitUnreadCountDelta(-1);
    await waitFor(() => expect(result.current.unreadCount).toBe(1));

    emitUnreadCountDelta(-1);
    await waitFor(() => expect(result.current.unreadCount).toBe(0));

    emitUnreadCountDelta(-1);
    await waitFor(() => expect(result.current.unreadCount).toBe(0));

    emitUnreadCountValue(4);
    await waitFor(() => expect(result.current.unreadCount).toBe(4));
  });
});
