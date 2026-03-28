export function formatEventDateLabel(startTime: string): string {
  const start = new Date(startTime);

  if (Number.isNaN(start.getTime())) {
    return 'Invalid date';
  }

  const datePart = start.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const timePart = start.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${datePart} • ${timePart}`;
}