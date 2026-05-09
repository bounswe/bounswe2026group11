import { apiGetAuth, apiPatchAuth, apiPostAuth, apiDeleteAuth } from './api';
import {
  UserProfile,
  EventSummary,
  UpdateProfileRequest,
  ChangePasswordRequest,
  ImageUploadInitResponse,
  ImageUploadConfirmRequest,
  FavoriteLocation,
  FavoriteLocationsResponse,
  CreateFavoriteLocationRequest,
  UpdateFavoriteLocationRequest,
  UserBadgesResponse,
  BadgeCatalogResponse,
} from '../models/profile';

interface EventListResponse {
  events: EventSummary[];
}

/**
 * Profile service for dealing with the /me endpoints
 */
export const profileService = {
  async getMyProfile(token: string): Promise<UserProfile> {
    return apiGetAuth<UserProfile>('/me', token);
  },

  async updateMyProfile(data: UpdateProfileRequest, token: string): Promise<void> {
    return apiPatchAuth<void>('/me', data, token);
  },

  async changePassword(data: ChangePasswordRequest, token: string): Promise<void> {
    return apiPostAuth<void>('/me/change-password', data, token);
  },

  async getHostedEvents(token: string): Promise<EventSummary[]> {
    const res = await apiGetAuth<EventListResponse>('/me/events/hosted', token);
    return res.events ?? [];
  },

  async getUpcomingEvents(token: string): Promise<EventSummary[]> {
    const res = await apiGetAuth<EventListResponse>('/me/events/upcoming', token);
    return res.events ?? [];
  },

  async getCompletedEvents(token: string): Promise<EventSummary[]> {
    const res = await apiGetAuth<EventListResponse>('/me/events/completed', token);
    return res.events ?? [];
  },

  async getCanceledEvents(token: string): Promise<EventSummary[]> {
    const res = await apiGetAuth<EventListResponse>('/me/events/canceled', token);
    return res.events ?? [];
  },

  async getAvatarUploadUrl(token: string): Promise<ImageUploadInitResponse> {
    return apiPostAuth<ImageUploadInitResponse>('/me/avatar/upload-url', {}, token);
  },

  async confirmAvatarUpload(body: ImageUploadConfirmRequest, token: string): Promise<void> {
    return apiPostAuth<void>('/me/avatar/confirm', body, token);
  },

  async getFavoriteLocations(token: string): Promise<FavoriteLocation[]> {
    const res = await apiGetAuth<FavoriteLocationsResponse>('/me/favorite-locations', token);
    return res.items ?? [];
  },

  async createFavoriteLocation(data: CreateFavoriteLocationRequest, token: string): Promise<FavoriteLocation> {
    return apiPostAuth<FavoriteLocation>('/me/favorite-locations', data, token);
  },

  async updateFavoriteLocation(id: string, data: UpdateFavoriteLocationRequest, token: string): Promise<FavoriteLocation> {
    return apiPatchAuth<FavoriteLocation>(`/me/favorite-locations/${id}`, data, token);
  },

  async deleteFavoriteLocation(id: string, token: string): Promise<void> {
    return apiDeleteAuth<void>(`/me/favorite-locations/${id}`, token);
  },

  async getMyBadges(token: string): Promise<UserBadgesResponse> {
    return apiGetAuth<UserBadgesResponse>('/me/badges', token);
  },

  async getUserBadges(userId: string, token: string): Promise<UserBadgesResponse> {
    return apiGetAuth<UserBadgesResponse>(`/users/${userId}/badges`, token);
  },

  async getBadgeCatalog(token: string): Promise<BadgeCatalogResponse> {
    return apiGetAuth<BadgeCatalogResponse>('/badges', token);
  },
};
