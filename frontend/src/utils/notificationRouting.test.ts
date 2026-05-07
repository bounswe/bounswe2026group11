import { describe, expect, it } from 'vitest';
import type { NotificationItem } from '@/models/notification';
import { resolveNotificationRoute } from './notificationRouting';

function makeNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'n-1',
    event_id: null,
    title: 'Title',
    body: 'Body',
    type: null,
    deep_link: null,
    image_url: null,
    data: {},
    is_read: false,
    read_at: null,
    created_at: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

describe('resolveNotificationRoute', () => {
  it('routes invitation-received notifications to /invitations regardless of event_id', () => {
    const route = resolveNotificationRoute(
      makeNotification({
        type: 'PRIVATE_EVENT_INVITATION_RECEIVED',
        event_id: 'abcdef0123456789abcdef01',
      }),
    );
    expect(route).toBe('/invitations');
  });

  it('routes approved/rejected join request notifications to the event detail page', () => {
    const eventId = 'abcdef01-2345-6789-abcd-ef0123456789';
    expect(
      resolveNotificationRoute(
        makeNotification({
          type: 'PROTECTED_EVENT_JOIN_REQUEST_APPROVED',
          event_id: eventId,
        }),
      ),
    ).toBe(`/events/${eventId}`);
    expect(
      resolveNotificationRoute(
        makeNotification({
          type: 'PROTECTED_EVENT_JOIN_REQUEST_REJECTED',
          event_id: eventId,
        }),
      ),
    ).toBe(`/events/${eventId}`);
  });

  it('falls back to event_id from data when top-level event_id is missing', () => {
    const eventId = 'abcdef01-2345-6789-abcd-ef0123456789';
    const route = resolveNotificationRoute(
      makeNotification({
        type: 'PROTECTED_EVENT_JOIN_REQUEST_APPROVED',
        event_id: null,
        data: { event_id: eventId },
      }),
    );
    expect(route).toBe(`/events/${eventId}`);
  });

  it('returns null when there is nothing to navigate to', () => {
    expect(resolveNotificationRoute(makeNotification({ type: null }))).toBeNull();
  });

  it('honors a deep_link pointing to /events/:id when no other route is determinable', () => {
    const route = resolveNotificationRoute(
      makeNotification({
        type: null,
        deep_link: 'app://events/abcdef0123456789abcdef01',
      }),
    );
    expect(route).toBe('/events/abcdef0123456789abcdef01');
  });
});
