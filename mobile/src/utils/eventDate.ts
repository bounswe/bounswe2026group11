export function formatEventDateLabel(
  startTime: string,
  endTime?: string | null,
): string {
  const start = new Date(startTime);

  if (Number.isNaN(start.getTime())) {
    return 'Invalid date';
  }

  const startDatePart = start.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const startTimePart = start.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  if (!endTime) {
    return `${startDatePart} • ${startTimePart}`;
  }

  const end = new Date(endTime);

  if (Number.isNaN(end.getTime())) {
    return `${startDatePart} • ${startTimePart}`;
  }

  const endDatePart = end.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const endTimePart = end.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const isSameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (isSameDay) {
    return `${startDatePart} • ${startTimePart} - ${endTimePart}`;
  }

  return `${startDatePart} • ${startTimePart} - ${endDatePart} • ${endTimePart}`;
}

/**
 * Returns the number of days remaining before an in-progress event without an
 * end date is auto-completed (at the 60-day mark), or `null` when no warning
 * should be displayed.
 *
 * A warning is shown between day 53 and day 59 (inclusive) since the event
 * started.
 */
export function getAutoCompletionDaysLeft(
  status: string,
  startTime: string,
  endTime?: string | null,
  now: Date = new Date(),
): number | null {
  if (status !== 'IN_PROGRESS' || endTime) return null;

  const daysSinceStart = Math.floor(
    (now.getTime() - new Date(startTime).getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSinceStart >= 53 && daysSinceStart < 60) {
    return 60 - daysSinceStart;
  }

  return null;
}