import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMyInvitation, listMyInvitations } from './invitationService';

vi.mock('@/config/api', () => ({
  API_BASE_URL: 'http://api.test',
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('invitationService', () => {
  it('fetches received invitations from the split pending/past endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        pending: [],
        past: {
          items: [],
          page_info: { next_cursor: null, has_next: false },
        },
      }), { status: 200 }),
    );

    const result = await listMyInvitations('access-token');

    expect(result.pending).toEqual([]);
    expect(result.past.items).toEqual([]);
    expect(fetch).toHaveBeenCalledWith('http://api.test/me/invitations', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      }),
      cache: 'no-store',
    }));
  });

  it('fetches one invitation detail by id', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ invitation_id: 'inv-1', status: 'PENDING' }), { status: 200 }),
    );

    await getMyInvitation('inv-1', 'access-token');

    expect(fetch).toHaveBeenCalledWith('http://api.test/me/invitations/inv-1', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer access-token',
      }),
      cache: 'no-store',
    }));
  });
});
