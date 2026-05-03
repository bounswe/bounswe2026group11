import { resolveNotificationRoute } from './notificationRouting';

describe('resolveNotificationRoute', () => {
  it('maps backend event deep links to the mobile event route', () => {
    expect(
      resolveNotificationRoute({
        deep_link: '/events/550e8400-e29b-41d4-a716-446655440000',
      }),
    ).toBe('/event/550e8400-e29b-41d4-a716-446655440000');
  });

  it('falls back to event_id metadata', () => {
    expect(
      resolveNotificationRoute({
        event_id: null,
        data: { event_id: '550e8400-e29b-41d4-a716-446655440000' },
      }),
    ).toBe('/event/550e8400-e29b-41d4-a716-446655440000');
  });

  it('routes notification links to the inbox', () => {
    expect(resolveNotificationRoute({ deep_link: '/notifications' })).toBe(
      '/notifications',
    );
  });

  it('returns null when the payload has no routable target', () => {
    expect(resolveNotificationRoute({ data: { source: 'admin' } })).toBeNull();
  });
});
