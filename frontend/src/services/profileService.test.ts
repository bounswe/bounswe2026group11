import { afterEach, describe, expect, it, vi } from 'vitest';
import { profileService } from './profileService';

vi.mock('@/config/api', () => ({
  API_BASE_URL: 'http://api.test',
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('profileService.changePassword', () => {
  it('posts the authenticated password endpoint with old and new password', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    await profileService.changePassword({
      old_password: 'old-password-123',
      new_password: 'new-password-456',
    }, 'access-token');

    expect(fetch).toHaveBeenCalledWith('http://api.test/me/change-password', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        old_password: 'old-password-123',
        new_password: 'new-password-456',
      }),
    }));
  });
});

describe('profileService badges', () => {
  it('fetches the authenticated user badges endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));

    await profileService.getMyBadges('access-token');

    expect(fetch).toHaveBeenCalledWith('http://api.test/me/badges', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      }),
      cache: 'no-store',
    }));
  });

  it('fetches another user badges endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));

    await profileService.getUserBadges('user-123', 'access-token');

    expect(fetch).toHaveBeenCalledWith('http://api.test/users/user-123/badges', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      }),
      cache: 'no-store',
    }));
  });

  it('fetches the badge catalog endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));

    await profileService.getBadgeCatalog('access-token');

    expect(fetch).toHaveBeenCalledWith('http://api.test/badges', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      }),
      cache: 'no-store',
    }));
  });
});
