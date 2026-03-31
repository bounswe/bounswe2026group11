import { apiGetAuth, apiPatchAuth } from './api';
import { UserProfile, UpdateProfileRequest } from '../models/profile';

/**
 * Profile service for dealing with the /me endpoints
 */
export const profileService = {
  /**
   * Fetches the profile of the currently authenticated user
   */
  async getMyProfile(token: string): Promise<UserProfile> {
    return apiGetAuth<UserProfile>('/me', token);
  },

  /**
   * Updates the profile of the currently authenticated user
   */
  async updateMyProfile(data: UpdateProfileRequest, token: string): Promise<void> {
    return apiPatchAuth<void>('/me', data, token);
  },
};
