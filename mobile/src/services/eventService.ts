import { apiPostAuth } from '@/services/api';
import {
  CreateEventRequest,
  CreateEventResponse,
  LocationSuggestion,
} from '@/models/event';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

export async function createEvent(
  request: CreateEventRequest,
  token: string,
): Promise<CreateEventResponse> {
  return apiPostAuth<CreateEventResponse>('/events', request, token);
}

export async function searchLocation(
  query: string,
): Promise<LocationSuggestion[]> {
  if (query.trim().length < 2) return [];

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    limit: '5',
  });

  const response = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: { 'User-Agent': 'BounSWE2026Group11MobileApp' },
  });

  if (!response.ok) return [];

  const data = await response.json();
  return data.map(
    (item: { display_name: string; lat: string; lon: string }) => ({
      display_name: item.display_name,
      lat: item.lat,
      lon: item.lon,
    }),
  );
}
