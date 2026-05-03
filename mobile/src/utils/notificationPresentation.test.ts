import type { NotificationItem } from '@/models/notification';
import {
  getNotificationPresentation,
  isDedicatedParticipationNotification,
} from '@/utils/notificationPresentation';

function makeNotification(
  overrides: Partial<NotificationItem> = {},
): NotificationItem {
  return {
    id: 'notification-1',
    event_id: 'event-1',
    title: 'Notification title',
    body: 'Notification body',
    type: 'PROTECTED_EVENT_JOIN_REQUEST_APPROVED',
    deep_link: '/events/event-1',
    image_url: null,
    data: {
      event_id: 'event-1',
      event_title: 'Sunrise Hike',
      event_start_time: '2026-05-09T08:30:00Z',
      actor_username: 'host-user',
      actor_display_name: 'Host User',
    },
    is_read: false,
    read_at: null,
    created_at: '2026-05-03T12:00:00Z',
    ...overrides,
  };
}

describe('notificationPresentation', () => {
  it('marks supported participation notifications as dedicated', () => {
    expect(
      isDedicatedParticipationNotification('PRIVATE_EVENT_INVITATION_RECEIVED'),
    ).toBe(true);
    expect(
      isDedicatedParticipationNotification(
        'PROTECTED_EVENT_JOIN_REQUEST_REJECTED',
      ),
    ).toBe(true);
    expect(
      isDedicatedParticipationNotification(
        'PROTECTED_EVENT_JOIN_REQUEST_SUBMITTED',
      ),
    ).toBe(true);
    expect(
      isDedicatedParticipationNotification('PRIVATE_EVENT_INVITATION_ACCEPTED'),
    ).toBe(false);
  });

  it('builds a dedicated invitation presentation', () => {
    const presentation = getNotificationPresentation(
      makeNotification({
        type: 'PRIVATE_EVENT_INVITATION_RECEIVED',
        body: 'Fallback body',
      }),
    );

    expect(presentation.badgeLabel).toBe('Invitation');
    expect(presentation.actionTarget).toBe('INVITATIONS');
    expect(presentation.actionLabel).toBe('Review invitation');
    expect(presentation.summary).toContain('invited you');
    expect(presentation.metadata).toContain('Sunrise Hike');
  });

  it('builds a dedicated rejection presentation with cooldown metadata', () => {
    const presentation = getNotificationPresentation(
      makeNotification({
        type: 'PROTECTED_EVENT_JOIN_REQUEST_REJECTED',
        data: {
          event_id: 'event-1',
          event_title: 'Sunrise Hike',
          event_start_time: '2026-05-09T08:30:00Z',
          actor_username: 'host-user',
          cooldown_ends_at: '2026-05-20T12:00:00Z',
        },
      }),
    );

    expect(presentation.badgeLabel).toBe('Rejected');
    expect(presentation.actionTarget).toBe('EVENT');
    expect(presentation.summary).toContain('rejected');
    expect(presentation.metadata.some((line) => line.startsWith('Retry after'))).toBe(true);
  });

  it('builds a dedicated submitted presentation for host', () => {
    const presentation = getNotificationPresentation(
      makeNotification({
        type: 'PROTECTED_EVENT_JOIN_REQUEST_SUBMITTED',
        data: {
          event_id: 'event-1',
          event_title: 'Sunrise Hike',
          event_start_time: '2026-05-09T08:30:00Z',
          actor_username: 'requester-user',
        },
      }),
    );

    expect(presentation.badgeLabel).toBe('New Request');
    expect(presentation.actionTarget).toBe('EVENT');
    expect(presentation.summary).toContain('wants to join');
  });

  it('falls back to generic presentation for unsupported types', () => {
    const presentation = getNotificationPresentation(
      makeNotification({
        type: 'ADMIN',
        body: 'Generic body',
      }),
    );

    expect(presentation.badgeLabel).toBeNull();
    expect(presentation.summary).toBe('Generic body');
    expect(presentation.actionTarget).toBe('EVENT');
  });
});
