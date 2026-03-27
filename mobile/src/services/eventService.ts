import { BASE_URL, ApiError, apiPostAuth } from '@/services/api';
import {
  CreateEventRequest,
  CreateEventResponse,
  LocationSuggestion,
  ListEventsQuery,
  PaginatedEventsResponse,
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

function appendArrayParam(
  params: URLSearchParams,
  key: string,
  values?: Array<string | number>,
) {
  if (!values || values.length === 0) return;
  params.set(key, values.join(','));
}

export async function listEvents(
  query: ListEventsQuery,
  token: string,
): Promise<PaginatedEventsResponse> {
  const params = new URLSearchParams();

  params.set('lat', String(query.lat));
  params.set('lon', String(query.lon));

  if (query.radius_meters != null) {
    params.set('radius_meters', String(query.radius_meters));
  }

  if (query.q?.trim()) {
    params.set('q', query.q.trim());
  }


  appendArrayParam(params, 'privacy_levels', query.privacy_levels);
  appendArrayParam(params, 'category_ids', query.category_ids);
  appendArrayParam(params, 'tag_names', query.tag_names);


  if (query.start_from) {
    params.set('start_from', query.start_from);
  }

  if (query.start_to) {
    params.set('start_to', query.start_to);
  }

  if (query.only_favorited != null) {
    params.set('only_favorited', String(query.only_favorited));
  }

  if (query.sort_by) {
    params.set('sort_by', query.sort_by);
  }

  if (query.limit != null) {
    params.set('limit', String(query.limit));
  }

  if (query.cursor) {
    params.set('cursor', query.cursor);
  }

  const response = await fetch(`${BASE_URL}/events?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json();
    throw new ApiError(response.status, errorBody);
  }

  return (await response.json()) as PaginatedEventsResponse;
}