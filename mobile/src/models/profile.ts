import type { EventSummary } from '@/models/event';

export interface ProfileScoreSummary {
  score: number | null;
  rating_count: number;
}

export interface ProfileEventSummary {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  privacy_level?: 'PUBLIC' | 'PROTECTED' | 'PRIVATE' | null;
  category?: string | null;
  image_url?: string | null;
}

export interface ProfileEventsResponse {
  events: ProfileEventSummary[];
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  phone_number: string | null;
  gender: string | null;
  birth_date: string | null;
  email_verified: boolean;
  status: string;
  default_location_address: string | null;
  default_location_lat: number | null;
  default_location_lon: number | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  final_score?: number | null;
  host_score?: ProfileScoreSummary | null;
  participant_score?: ProfileScoreSummary | null;
  created_events?: EventSummary[];
  attended_events?: EventSummary[];
}

export interface UpdateProfileRequest {
  phone_number?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  default_location_address?: string | null;
  default_location_lat?: number | null;
  default_location_lon?: number | null;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
}
