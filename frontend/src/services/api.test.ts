import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiGetAuth, apiPostAuth, apiPatchAuth, setTokenRefreshManager } from './api';

// Helper to build a minimal fetch Response
function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const SESSION_RESPONSE = {
  access_token: 'new-access-token',
  refresh_token: 'new-refresh-token',
  token_type: 'Bearer' as const,
  expires_in_seconds: 900,
  user: { id: '1', username: 'testuser', email: 'test@example.com', phone_number: null, email_verified: true, status: 'active', role: 'ADMIN' },
};

const onRefreshSuccess = vi.fn();
const onRefreshFailure = vi.fn();

const manager = {
  getRefreshToken: () => 'stored-refresh-token',
  onRefreshSuccess,
  onRefreshFailure,
};

beforeEach(() => {
  vi.resetAllMocks();
  setTokenRefreshManager(manager);
});

afterEach(() => {
  setTokenRefreshManager(null);
});

describe('apiGetAuth', () => {
  it('returns data on a successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { id: 42 })));

    const result = await apiGetAuth<{ id: number }>('/events/42', 'valid-token');

    expect(result).toEqual({ id: 42 });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('silently refreshes on 401 and retries with the new token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(mockResponse(401, { error: { code: 'unauthorized', message: 'Unauthorized' } })) // original request
        .mockResolvedValueOnce(mockResponse(200, SESSION_RESPONSE))   // POST /auth/refresh
        .mockResolvedValueOnce(mockResponse(200, { id: 42 })),         // retry
    );

    const result = await apiGetAuth<{ id: number }>('/events/42', 'expired-token');

    expect(result).toEqual({ id: 42 });
    expect(fetch).toHaveBeenCalledTimes(3);

    // Refresh request should use the stored refresh token
    const refreshCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(refreshCall[0]).toContain('/auth/refresh');
    expect(JSON.parse(refreshCall[1].body)).toEqual({ refresh_token: 'stored-refresh-token' });
  });

  it('calls onRefreshSuccess with new tokens after a successful refresh', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(mockResponse(401, { error: { code: 'unauthorized', message: 'Unauthorized' } }))
        .mockResolvedValueOnce(mockResponse(200, SESSION_RESPONSE))
        .mockResolvedValueOnce(mockResponse(200, {})),
    );

    await apiGetAuth('/events/1', 'expired-token');

    expect(onRefreshSuccess).toHaveBeenCalledOnce();
    expect(onRefreshSuccess).toHaveBeenCalledWith(
      'new-access-token',
      'new-refresh-token',
      'testuser',
      'ADMIN',
    );
  });

  it('calls onRefreshFailure and throws when refresh request returns 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(mockResponse(401, { error: { code: 'unauthorized', message: 'Unauthorized' } }))
        .mockResolvedValueOnce(mockResponse(401, { error: { code: 'invalid_refresh_token', message: 'Refresh token invalid.' } })),
    );

    await expect(apiGetAuth('/events/1', 'expired-token')).rejects.toBeInstanceOf(ApiError);
    expect(onRefreshFailure).toHaveBeenCalledOnce();
    expect(onRefreshSuccess).not.toHaveBeenCalled();
  });

  it('throws without attempting refresh when no token manager is set', async () => {
    setTokenRefreshManager(null);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse(401, { error: { code: 'unauthorized', message: 'Unauthorized' } }),
      ),
    );

    await expect(apiGetAuth('/events/1', 'token')).rejects.toBeInstanceOf(ApiError);
    // Only one call — no refresh attempt
    expect(fetch).toHaveBeenCalledOnce();
    expect(onRefreshFailure).not.toHaveBeenCalled();
  });

  it('throws when retry after refresh also returns 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(mockResponse(401, { error: { code: 'unauthorized', message: 'Unauthorized' } }))
        .mockResolvedValueOnce(mockResponse(200, SESSION_RESPONSE))
        .mockResolvedValueOnce(mockResponse(401, { error: { code: 'unauthorized', message: 'Unauthorized' } })),
    );

    await expect(apiGetAuth('/events/1', 'expired-token')).rejects.toBeInstanceOf(ApiError);
  });

  it('deduplicates concurrent refresh calls', async () => {
    let refreshResolve!: (v: Response) => void;
    const refreshPromise = new Promise<Response>((res) => { refreshResolve = res; });

    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(mockResponse(401, { error: { code: 'unauthorized', message: 'Unauthorized' } }))
        .mockResolvedValueOnce(mockResponse(401, { error: { code: 'unauthorized', message: 'Unauthorized' } }))
        .mockImplementationOnce(() => refreshPromise) // single refresh call
        .mockResolvedValue(mockResponse(200, { id: 1 })),
    );

    // Fire two concurrent authenticated requests
    const p1 = apiGetAuth('/events/1', 'expired-token');
    const p2 = apiGetAuth('/events/2', 'expired-token');

    // Let the refresh resolve
    refreshResolve(mockResponse(200, SESSION_RESPONSE));

    await Promise.all([p1, p2]);

    const allCalls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    const refreshCalls = allCalls.filter((c) => String(c[0]).includes('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });
});

describe('apiPostAuth', () => {
  it('returns data on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { joined: true })));

    const result = await apiPostAuth<{ joined: boolean }>('/events/1/join', {}, 'valid-token');

    expect(result).toEqual({ joined: true });
  });

  it('silently refreshes on 401 and retries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(mockResponse(401, { error: { code: 'unauthorized', message: 'Unauthorized' } }))
        .mockResolvedValueOnce(mockResponse(200, SESSION_RESPONSE))
        .mockResolvedValueOnce(mockResponse(200, { joined: true })),
    );

    const result = await apiPostAuth<{ joined: boolean }>('/events/1/join', {}, 'expired-token');

    expect(result).toEqual({ joined: true });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('returns undefined for 204 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(204, null)));

    const result = await apiPostAuth('/events/1/leave', {}, 'valid-token');

    expect(result).toBeUndefined();
  });
});

describe('apiPatchAuth', () => {
  it('returns updated data on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { username: 'updated' })));

    const result = await apiPatchAuth<{ username: string }>('/profile', { username: 'updated' }, 'valid-token');

    expect(result).toEqual({ username: 'updated' });
  });

  it('silently refreshes on 401 and retries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(mockResponse(401, { error: { code: 'unauthorized', message: 'Unauthorized' } }))
        .mockResolvedValueOnce(mockResponse(200, SESSION_RESPONSE))
        .mockResolvedValueOnce(mockResponse(200, { username: 'updated' })),
    );

    const result = await apiPatchAuth('/profile', { username: 'updated' }, 'expired-token');

    expect(result).toEqual({ username: 'updated' });
  });
});
