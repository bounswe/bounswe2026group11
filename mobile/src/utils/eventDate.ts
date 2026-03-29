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