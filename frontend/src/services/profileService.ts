import { apiGetAuth, apiPatchAuth, apiPostAuth } from './api';
import {
  UserProfile,
  EventSummary,
  UpdateProfileRequest,
  ImageUploadInitResponse,
  ImageUploadConfirmRequest,
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
};
