import { apiGetAuth, apiPatchAuth, apiPostAuth } from '@/services/api';
import { ImageUploadInitResponse } from '@/models/event';
import {
  ProfileEventsResponse,
  UserProfile,
  UpdateProfileRequest,
} from '@/models/profile';

export function getMyProfile(token: string): Promise<UserProfile> {
  return apiGetAuth<UserProfile>('/me', token);
}

export function getMyHostedEvents(token: string): Promise<ProfileEventsResponse> {
  return apiGetAuth<ProfileEventsResponse>('/me/events/hosted', token);
}

export function getMyUpcomingEvents(token: string): Promise<ProfileEventsResponse> {
  return apiGetAuth<ProfileEventsResponse>('/me/events/upcoming', token);
}

export function getMyCompletedEvents(token: string): Promise<ProfileEventsResponse> {
  return apiGetAuth<ProfileEventsResponse>('/me/events/completed', token);
}

export function getMyCanceledEvents(token: string): Promise<ProfileEventsResponse> {
  return apiGetAuth<ProfileEventsResponse>('/me/events/canceled', token);
}

export function getProfileAvatarUploadUrl(
  token: string,
): Promise<ImageUploadInitResponse> {
  return apiPostAuth<ImageUploadInitResponse>('/me/avatar/upload-url', {}, token);
}

export function confirmProfileAvatarUpload(
  confirmToken: string,
  token: string,
): Promise<void> {
  return apiPostAuth<void>(
    '/me/avatar/confirm',
    { confirm_token: confirmToken },
    token,
  );
}

export function updateMyProfile(
  data: UpdateProfileRequest,
  token: string,
): Promise<void> {
  return apiPatchAuth<void>('/me', data, token);
}

export function searchUsers(
  query: string,
  token: string,
): Promise<{ items: Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null }> }> {
  return apiGetAuth<any>(`/users/search?query=${encodeURIComponent(query)}`, token);
}

export function changePassword(
  oldPassword: string,
  newPassword: string,
  token: string,
): Promise<void> {
  return apiPostAuth<void>(
    '/me/change-password',
    {
      old_password: oldPassword,
      new_password: newPassword,
    },
    token,
  );
}
