export const NOTIFICATION_UNREAD_COUNT_EVENT = 'sem:notification-unread-count';

export interface NotificationUnreadCountEventDetail {
  delta?: number;
  count?: number;
}

export function emitUnreadCountDelta(delta: number): void {
  window.dispatchEvent(
    new CustomEvent<NotificationUnreadCountEventDetail>(
      NOTIFICATION_UNREAD_COUNT_EVENT,
      { detail: { delta } },
    ),
  );
}

export function emitUnreadCountValue(count: number): void {
  window.dispatchEvent(
    new CustomEvent<NotificationUnreadCountEventDetail>(
      NOTIFICATION_UNREAD_COUNT_EVENT,
      { detail: { count } },
    ),
  );
}
