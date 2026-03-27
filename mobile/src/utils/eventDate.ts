export function formatEventDateLabel(
  startTime: string,
  endTime?: string | null,
): string {
  const start = new Date(startTime);

  if (Number.isNaN(start.getTime())) {
    return 'Invalid date';
  }

  const datePart = start.toLocaleDateString([], {
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
    return `${datePart} • ${startTimePart}`;
  }

  const end = new Date(endTime);

  if (Number.isNaN(end.getTime())) {
    return `${datePart} • ${startTimePart}`;
  }

  const endTimePart = end.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${datePart} • ${startTimePart} - ${endTimePart}`;
}