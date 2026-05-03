import { normalizePushNotificationPayload } from './pushNotificationPayload';

describe('normalizePushNotificationPayload', () => {
  it('normalizes notification and data payload fields', () => {
    expect(
      normalizePushNotificationPayload({
        messageId: 'message-1',
        notification: {
          title: 'Event update',
          body: 'Your request was approved.',
        },
        data: {
          event_id: 'event-1',
          deep_link: '/events/event-1',
          notification_id: 'notification-1',
        },
      }),
    ).toEqual({
      title: 'Event update',
      body: 'Your request was approved.',
      notification_id: 'notification-1',
      event_id: 'event-1',
      deep_link: '/events/event-1',
      data: {
        event_id: 'event-1',
        deep_link: '/events/event-1',
        notification_id: 'notification-1',
      },
    });
  });

  it('falls back to data fields and message id', () => {
    expect(
      normalizePushNotificationPayload({
        messageId: 'message-1',
        data: { title: 'Fallback title', body: 'Fallback body' },
      }),
    ).toMatchObject({
      title: 'Fallback title',
      body: 'Fallback body',
      notification_id: 'message-1',
    });
  });
});
