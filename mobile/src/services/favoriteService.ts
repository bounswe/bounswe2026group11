import { apiGetAuth, apiPostAuth, apiDeleteAuth } from '@/services/api';
import {
  CreateFavoriteLocationRequest,
  FavoriteEventsResponse,
  FavoriteLocation,
  FavoriteLocationsResponse,
} from '@/models/favorite';

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

export async function listFavoriteLocations(
  token: string,
): Promise<FavoriteLocationsResponse> {
  return apiGetAuth<FavoriteLocationsResponse>('/me/favorite-locations', token);
}

export async function createFavoriteLocation(
  request: CreateFavoriteLocationRequest,
  token: string,
): Promise<FavoriteLocation> {
  return apiPostAuth<FavoriteLocation>('/me/favorite-locations', request, token);
}

export async function deleteFavoriteLocation(
  favoriteLocationId: string,
  token: string,
): Promise<void> {
  return apiDeleteAuth<void>(`/me/favorite-locations/${favoriteLocationId}`, token);
}
