/** First two comma-separated parts (e.g. district, city), deduplicated — matches mobile `formatEventLocation`. */
export function formatEventLocation(address?: string | null): string {
  if (!address) {
    return 'Location not specified';
  }

  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const uniqueParts = parts.filter(
    (part, index) =>
      index === parts.findIndex((p) => p.toLowerCase() === part.toLowerCase()),
  );

  if (uniqueParts.length >= 2) {
    return `${uniqueParts[0]}, ${uniqueParts[1]}`;
  }

  return uniqueParts[0] ?? 'Location not specified';
}
