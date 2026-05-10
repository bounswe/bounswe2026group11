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

describe('profileService public profile', () => {
  it('fetches the public profile endpoint without authentication', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      user_id: 'user-123',
      username: 'hiker',
      host_rating_count: 0,
      participant_rating_count: 0,
      equipment: [],
      showcase_images: [],
    }), { status: 200 }));

    await profileService.getPublicProfile('user-123');

    expect(fetch).toHaveBeenCalledWith('http://api.test/users/user-123/profile', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
      }),
      cache: 'no-store',
    }));
  });
});

describe('profileService equipment', () => {
  it('creates an equipment item for the authenticated user', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'eq-1', name: 'Trail Shoes' }), { status: 201 }));

    await profileService.createEquipment({
      name: 'Trail Shoes',
      description: 'Grip-heavy shoes for mixed terrain.',
      image_url: 'https://example.com/shoes.jpg',
    }, 'access-token');

    expect(fetch).toHaveBeenCalledWith('http://api.test/me/equipment', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        name: 'Trail Shoes',
        description: 'Grip-heavy shoes for mixed terrain.',
        image_url: 'https://example.com/shoes.jpg',
      }),
    }));
  });

  it('updates an equipment item for the authenticated user', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'eq-1', name: 'Trail Shoes' }), { status: 200 }));

    await profileService.updateEquipment('eq-1', {
      description: 'Updated description',
    }, 'access-token');

    expect(fetch).toHaveBeenCalledWith('http://api.test/me/equipment/eq-1', expect.objectContaining({
      method: 'PATCH',
      headers: expect.objectContaining({
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        description: 'Updated description',
      }),
    }));
  });
});

describe('profileService showcase images', () => {
  it('requests showcase upload instructions for the authenticated user', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      base_url: 'https://cdn.example.com/image.jpg',
      version: 1,
      confirm_token: 'confirm-token',
      uploads: [],
    }), { status: 200 }));

    await profileService.getShowcaseUploadUrl('access-token');

    expect(fetch).toHaveBeenCalledWith('http://api.test/me/showcase-images/upload-url', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({}),
    }));
  });

  it('confirms a showcase image upload for the authenticated user', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      id: 'showcase-1',
      image_url: 'https://cdn.example.com/image.jpg',
    }), { status: 201 }));

    await profileService.confirmShowcaseUpload({ confirm_token: 'confirm-token' }, 'access-token');

    expect(fetch).toHaveBeenCalledWith('http://api.test/me/showcase-images/confirm', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        confirm_token: 'confirm-token',
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
