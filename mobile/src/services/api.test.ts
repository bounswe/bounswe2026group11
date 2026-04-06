const originalFetch = global.fetch;

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as any;
}

describe('api auth refresh handling', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('refreshes and retries an authenticated request after a 401 response', async () => {
    const mockFetch = jest.fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'unauthorized',
              message: 'Access token expired.',
            },
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'fresh-access',
          refresh_token: 'fresh-refresh',
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
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    global.fetch = mockFetch as any;

    const secureStore = require('expo-secure-store');
    secureStore.__reset();

    const sessionManager = await import('./sessionManager');
    await sessionManager.setSession({
      access_token: 'stale-access',
      refresh_token: 'stale-refresh',
      user: {
        id: 'user-1',
        username: 'maplover',
        email: 'user@example.com',
        phone_number: null,
        email_verified: true,
        status: 'active',
      },
    });

    const { apiGetAuth } = await import('./api');
    const result = await apiGetAuth<{ ok: boolean }>('/me', 'stale-access');

    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/me'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer stale-access',
        }),
      }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/auth/refresh'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('/me'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer fresh-access',
        }),
      }),
    );
  });
});
