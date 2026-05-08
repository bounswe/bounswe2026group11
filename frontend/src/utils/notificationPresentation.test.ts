import { describe, expect, it } from 'vitest';
import type { NotificationItem } from '@/models/notification';
import {
  getNotificationPresentation,
  isDedicatedParticipationNotification,
} from './notificationPresentation';

function makeNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'n-1',
    event_id: 'event-1',
    title: 'Generic title',
    body: 'Generic body',
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

describe('getNotificationPresentation', () => {
  it('returns invitation copy and routes to invitations for PRIVATE_EVENT_INVITATION_RECEIVED', () => {
    const presentation = getNotificationPresentation(
      makeNotification({
        type: 'PRIVATE_EVENT_INVITATION_RECEIVED',
        data: { actor_username: 'host', event_title: 'Sunset Walk' },
      }),
    );
    expect(presentation.badgeLabel).toBe('Invitation');
    expect(presentation.summary).toContain('host');
    expect(presentation.eventTitle).toBe('Sunset Walk');
    expect(presentation.actionTarget).toBe('INVITATIONS');
    expect(presentation.actionLabel).toBe('Review invitation');
  });

  it('returns approved copy and routes to event for PROTECTED_EVENT_JOIN_REQUEST_APPROVED', () => {
    const presentation = getNotificationPresentation(
      makeNotification({
        type: 'PROTECTED_EVENT_JOIN_REQUEST_APPROVED',
        data: { actor_display_name: 'Host User' },
      }),
    );
    expect(presentation.badgeLabel).toBe('Approved');
    expect(presentation.summary).toContain('Host User');
    expect(presentation.actionTarget).toBe('EVENT');
  });

  it('formats cooldown metadata for PROTECTED_EVENT_JOIN_REQUEST_REJECTED', () => {
    const presentation = getNotificationPresentation(
      makeNotification({
        type: 'PROTECTED_EVENT_JOIN_REQUEST_REJECTED',
        data: { cooldown_ends_at: '2026-04-08T00:00:00Z' },
      }),
    );
    expect(presentation.badgeLabel).toBe('Rejected');
    expect(presentation.metadata.length).toBe(1);
    expect(presentation.metadata[0]).toMatch(/Retry after/);
  });

  it('falls back to generic title and body for unknown notification types', () => {
    const presentation = getNotificationPresentation(
      makeNotification({
        type: 'SOMETHING_NEW',
        title: 'A new alert',
        body: 'Body text',
      }),
    );
    expect(presentation.badgeLabel).toBeNull();
    expect(presentation.title).toBe('A new alert');
    expect(presentation.summary).toBe('Body text');
    expect(presentation.actionTarget).toBe('EVENT');
  });

  it('returns NONE action target when notification has no event reference', () => {
    const presentation = getNotificationPresentation(
      makeNotification({
        type: null,
        event_id: null,
        data: {},
      }),
    );
    expect(presentation.actionTarget).toBe('NONE');
    expect(presentation.actionLabel).toBeNull();
  });
});

describe('isDedicatedParticipationNotification', () => {
  it('returns true for participation-related types', () => {
    expect(isDedicatedParticipationNotification('PRIVATE_EVENT_INVITATION_RECEIVED')).toBe(true);
    expect(isDedicatedParticipationNotification('PROTECTED_EVENT_JOIN_REQUEST_APPROVED')).toBe(true);
    expect(isDedicatedParticipationNotification('EVENT_CANCELED')).toBe(true);
  });

  it('returns false for unknown or null types', () => {
    expect(isDedicatedParticipationNotification(null)).toBe(false);
    expect(isDedicatedParticipationNotification('UNKNOWN')).toBe(false);
  });
});
