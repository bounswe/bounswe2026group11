import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAdminListPath,
  cancelAdminParticipation,
  createAdminNotification,
  createAdminParticipation,
} from './adminService';

vi.mock('@/config/api', () => ({
  API_BASE_URL: 'http://api.test',
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildAdminListPath', () => {
  it('serializes filters and pagination while skipping empty values', () => {
    const path = buildAdminListPath('/admin/users', {
      q: 'ali',
      role: 'ADMIN',
      status: '',
      created_from: '2026-05-06T10:00',
      created_to: undefined,
      limit: 25,
      offset: 50,
    });

    const url = new URL(path, 'http://localhost');
    expect(url.pathname).toBe('/admin/users');
    expect(url.searchParams.get('q')).toBe('ali');
    expect(url.searchParams.get('role')).toBe('ADMIN');
    expect(url.searchParams.get('status')).toBeNull();
    expect(url.searchParams.get('limit')).toBe('25');
    expect(url.searchParams.get('offset')).toBe('50');

    const createdFrom = url.searchParams.get('created_from');
    expect(createdFrom).toBeTruthy();
    expect(createdFrom).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
    expect(Number.isNaN(new Date(createdFrom as string).getTime())).toBe(false);
  });
});

describe('admin mutation services', () => {
  it('posts notification payloads with delivery mode', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      target_user_count: 1,
      created_count: 1,
      idempotent_count: 0,
      sse_delivery_count: 1,
      push_active_device_count: 0,
      push_sent_count: 0,
      push_failed_count: 0,
      invalid_token_count: 0,
    }), { status: 201 }));

    await createAdminNotification('token', {
      user_ids: ['11111111-1111-4111-8111-111111111111'],
      delivery_mode: 'BOTH',
      title: 'Title',
      body: 'Body',
    });

    expect(fetch).toHaveBeenCalledWith('http://api.test/admin/notifications', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        user_ids: ['11111111-1111-4111-8111-111111111111'],
        delivery_mode: 'BOTH',
        title: 'Title',
        body: 'Body',
      }),
    }));
  });

  it('posts participation create and cancel actions', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        participation_id: '33333333-3333-4333-8333-333333333333',
        event_id: '11111111-1111-4111-8111-111111111111',
        user_id: '22222222-2222-4222-8222-222222222222',
        status: 'APPROVED',
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        participation_id: '33333333-3333-4333-8333-333333333333',
        event_id: '11111111-1111-4111-8111-111111111111',
        user_id: '22222222-2222-4222-8222-222222222222',
        status: 'CANCELED',
        already_canceled: false,
      }), { status: 200 }));

    await createAdminParticipation('token', {
      event_id: '11111111-1111-4111-8111-111111111111',
      user_id: '22222222-2222-4222-8222-222222222222',
      status: 'APPROVED',
    });
    await cancelAdminParticipation('token', '33333333-3333-4333-8333-333333333333');

    expect(fetch).toHaveBeenNthCalledWith(1, 'http://api.test/admin/participations', expect.objectContaining({
      method: 'POST',
    }));
    expect(fetch).toHaveBeenNthCalledWith(2, 'http://api.test/admin/participations/33333333-3333-4333-8333-333333333333/cancel', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({}),
    }));
  });
});
