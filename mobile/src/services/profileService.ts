import { apiGetAuth, apiPatchAuth, apiPostAuth } from '@/services/api';
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

export function updateMyProfile(
  data: UpdateProfileRequest,
  token: string,
): Promise<void> {
  return apiPatchAuth<void>('/me', data, token);
}
