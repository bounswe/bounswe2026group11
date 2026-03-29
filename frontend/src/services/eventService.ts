import { apiPostAuth, apiGet } from './api';
import {
  CreateEventRequest,
  CreateEventResponse,
  ListCategoriesResponse,
  LocationSuggestion,
} from '@/models/event';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

export function createEvent(
  request: CreateEventRequest,
  token: string,
): Promise<CreateEventResponse> {
  return apiPostAuth<CreateEventResponse>('/events/', request, token);
}

export function listCategories(): Promise<ListCategoriesResponse> {
  return apiGet<ListCategoriesResponse>('/categories/');
}

export async function searchLocation(
  query: string,
): Promise<LocationSuggestion[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
  });
  const response = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: { 'User-Agent': 'SocialEventMapper/1.0' },
  });
  if (!response.ok) return [];
  return response.json();
}
