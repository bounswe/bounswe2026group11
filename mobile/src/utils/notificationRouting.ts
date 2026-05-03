interface RoutableNotificationPayload {
  event_id?: string | null;
  deep_link?: string | null;
  data?: Record<string, string> | null;
}

const UUIDISH_SEGMENT = '[0-9a-fA-F-]{20,}';

function normalizeEventRoute(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const eventRouteMatch = trimmed.match(
    new RegExp(`(?:^|://|/)(?:events|event)/(${UUIDISH_SEGMENT})(?:$|[/?#])`),
  );
  if (eventRouteMatch?.[1]) {
    return `/event/${eventRouteMatch[1]}`;
  }

  const notificationRouteMatch = trimmed.match(
    /(?:^|:\/\/|\/)notifications(?:$|[/?#])/,
  );
  if (notificationRouteMatch) {
    return '/notifications';
  }

  return null;
}

export function resolveNotificationRoute(
  notification: RoutableNotificationPayload,
): string | null {
  const explicitRoute = notification.deep_link
    ? normalizeEventRoute(notification.deep_link)
    : null;
  if (explicitRoute) return explicitRoute;

  const eventID = notification.event_id ?? notification.data?.event_id;
  if (eventID) {
    return `/event/${eventID}`;
  }

  return null;
}
