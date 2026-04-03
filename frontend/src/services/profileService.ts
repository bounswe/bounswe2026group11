import { apiGetAuth, apiPatchAuth } from './api';
import { UserProfile, EventSummary, UpdateProfileRequest } from '../models/profile';

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
};
