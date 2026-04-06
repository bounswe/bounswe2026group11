import type { AuthSessionResponse, StoredAuthSession } from '@/models/auth';

const originalFetch = global.fetch;

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as any;
}

function buildSession(overrides: Partial<AuthSessionResponse> = {}): AuthSessionResponse {
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    token_type: 'Bearer',
    expires_in_seconds: 900,
    user: {
      id: 'user-1',
      username: 'maplover',
      email: 'user@example.com',
      phone_number: null,
      email_verified: true,
      status: 'active',
    },
    ...overrides,
  };
}

describe('sessionManager', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('rotates tokens once and shares a single in-flight refresh request', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      jsonResponse(
        buildSession({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
        }),
      ),
    );
    global.fetch = mockFetch as any;

    const secureStore = require('expo-secure-store');
    secureStore.__reset();

    const sessionManager = await import('./sessionManager');
    await sessionManager.setSession({
      access_token: 'old-access',
      refresh_token: 'old-refresh',
      user: buildSession().user,
    });

    const [first, second] = await Promise.all([
      sessionManager.refreshSession(),
      sessionManager.refreshSession(),
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first.access_token).toBe('new-access');
    expect(first.refresh_token).toBe('new-refresh');
    expect(secureStore.setItemAsync).toHaveBeenLastCalledWith(
      'auth_session',
      JSON.stringify(first),
    );
  });

  it('clears the stored session when refresh fails terminally', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'invalid_refresh_token',
            message: 'Refresh token is invalid.',
          },
        },
        401,
      ),
    );
    global.fetch = mockFetch as any;

    const secureStore = require('expo-secure-store');
    secureStore.__reset();

    const sessionManager = await import('./sessionManager');
    const initialSession: StoredAuthSession = {
      access_token: 'old-access',
      refresh_token: 'old-refresh',
      user: buildSession().user,
    };
    await sessionManager.setSession(initialSession);

    await expect(sessionManager.refreshSession()).rejects.toMatchObject({
      status: 401,
    });

    expect(sessionManager.getCurrentSession()).toBeNull();
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('auth_session');
  });
});
