import { apiGetAuth, apiPatchAuth, apiPostAuth, apiDeleteAuth } from '@/services/api';
import { ImageUploadInitResponse } from '@/models/event';
import {
  ProfileEventsResponse,
  UserProfile,
  UpdateProfileRequest,
  PublicProfile,
  EquipmentItem,
  CreateEquipmentRequest,
  UpdateEquipmentRequest,
  BadgeItem,
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

export function getPublicProfile(
  userId: string,
  token: string,
): Promise<PublicProfile> {
  return apiGetAuth<PublicProfile>(`/users/${userId}/profile`, token);
}

// Equipment CRUD
export function getMyEquipment(token: string): Promise<{ items: EquipmentItem[] }> {
  return apiGetAuth<{ items: EquipmentItem[] }>('/me/equipment', token);
}

export function createEquipment(
  data: CreateEquipmentRequest,
  token: string,
): Promise<EquipmentItem> {
  return apiPostAuth<EquipmentItem>('/me/equipment', data, token);
}

export function updateEquipment(
  equipmentId: string,
  data: UpdateEquipmentRequest,
  token: string,
): Promise<EquipmentItem> {
  return apiPatchAuth<EquipmentItem>(`/me/equipment/${equipmentId}`, data, token);
}

export function deleteEquipment(
  equipmentId: string,
  token: string,
): Promise<void> {
  return apiDeleteAuth<void>(`/me/equipment/${equipmentId}`, token);
}

// Showcase Images
export function getShowcaseImageUploadUrl(
  token: string,
): Promise<ImageUploadInitResponse> {
  return apiPostAuth<ImageUploadInitResponse>('/me/showcase-images/upload-url', {}, token);
}

export function confirmShowcaseImageUpload(
  confirmToken: string,
  token: string,
): Promise<void> {
  return apiPostAuth<void>(
    '/me/showcase-images/confirm',
    { confirm_token: confirmToken },
    token,
  );
}

export function deleteShowcaseImage(
  showcaseImageId: string,
  token: string,
): Promise<void> {
  return apiDeleteAuth<void>(`/me/showcase-images/${showcaseImageId}`, token);
}

// Badges
export function getMyBadges(token: string): Promise<{ items: BadgeItem[] }> {
  return apiGetAuth<{ items: BadgeItem[] }>('/me/badges', token);
}

export function getUserBadges(
  userId: string,
  token: string,
): Promise<{ items: BadgeItem[] }> {
  return apiGetAuth<{ items: BadgeItem[] }>(`/users/${userId}/badges`, token);
}

export function getBadgeCatalog(token: string): Promise<{ items: BadgeItem[] }> {
  return apiGetAuth<{ items: BadgeItem[] }>('/badges', token);
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
