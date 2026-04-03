import { apiGetAuth, apiPostAuth, apiDeleteAuth } from '@/services/api';
import { FavoriteEventsResponse } from '@/models/favorite';

export async function listFavoriteEvents(
  token: string,
): Promise<FavoriteEventsResponse> {
  return apiGetAuth<FavoriteEventsResponse>('/me/favorites', token);
}

export async function addFavorite(
  eventId: string,
  token: string,
): Promise<void> {
  return apiPostAuth<void>(`/events/${eventId}/favorite`, {}, token);
}

export async function removeFavorite(
  eventId: string,
  token: string,
): Promise<void> {
  return apiDeleteAuth<void>(`/events/${eventId}/favorite`, token);
}
