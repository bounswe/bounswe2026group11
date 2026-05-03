import * as api from './api';
import {
  deleteAllNotifications,
  deleteNotification,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notificationService';

jest.mock('./api');

const mockApiGetAuth = jest.mocked(api.apiGetAuth);
const mockApiPatchAuth = jest.mocked(api.apiPatchAuth);
const mockApiDeleteAuth = jest.mocked(api.apiDeleteAuth);

describe('notificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGetAuth.mockResolvedValue({
      items: [],
      page_info: { next_cursor: null, has_next: false },
    });
    mockApiPatchAuth.mockResolvedValue(undefined);
    mockApiDeleteAuth.mockResolvedValue(undefined);
  });

  it('lists notifications through the authenticated feed endpoint', async () => {
    await listNotifications('access-token', {
      limit: 10,
      cursor: 'next-cursor',
    });

    expect(mockApiGetAuth).toHaveBeenCalledWith(
      '/me/notifications?limit=10&cursor=next-cursor',
      'access-token',
    );
  });

  it('lists unread notifications when requested', async () => {
    await listNotifications('access-token', { onlyUnread: true });

    expect(mockApiGetAuth).toHaveBeenCalledWith(
      '/me/notifications/unread',
      'access-token',
    );
  });

  it('fetches unread count', async () => {
    mockApiGetAuth.mockResolvedValueOnce({ unread_count: 3 });

    const result = await getUnreadNotificationCount('access-token');

    expect(result).toEqual({ unread_count: 3 });
    expect(mockApiGetAuth).toHaveBeenCalledWith(
      '/me/notifications/unread-count',
      'access-token',
    );
  });

  it('marks notifications as read', async () => {
    await markNotificationRead('notification-1', 'access-token');
    await markAllNotificationsRead('access-token');

    expect(mockApiPatchAuth).toHaveBeenNthCalledWith(
      1,
      '/me/notifications/notification-1/read',
      {},
      'access-token',
    );
    expect(mockApiPatchAuth).toHaveBeenNthCalledWith(
      2,
      '/me/notifications/read',
      {},
      'access-token',
    );
  });

  it('deletes one notification or the whole visible feed', async () => {
    await deleteNotification('notification-1', 'access-token');
    await deleteAllNotifications('access-token');

    expect(mockApiDeleteAuth).toHaveBeenNthCalledWith(
      1,
      '/me/notifications/notification-1',
      'access-token',
    );
    expect(mockApiDeleteAuth).toHaveBeenNthCalledWith(
      2,
      '/me/notifications',
      'access-token',
    );
  });
});
