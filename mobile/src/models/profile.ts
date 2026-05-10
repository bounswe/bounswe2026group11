import type { EventSummary, PrivacyLevel } from '@/models/event';

export type BadgeCategory = 'HOSTING' | 'PARTICIPATION' | 'SOCIAL';

export interface BadgeItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: BadgeCategory;
  icon_url: string | null;
  earned: boolean;
  earned_at: string | null;
  progress_hint?: string | null;
}

export interface EquipmentItem {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
}

export interface ShowcaseImageItem {
  id: string;
  image_url: string;
}

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
  locale: string;
  default_location_address: string | null;
  default_location_lat: number | null;
  default_location_lon: number | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  final_score?: number | null;
  host_score?: ProfileScoreSummary | null;
  participant_score?: ProfileScoreSummary | null;
  equipment?: EquipmentItem[];
  showcase_images?: ShowcaseImageItem[];
  badges?: BadgeItem[];
  created_events?: ProfileEventSummary[];
  attended_events?: ProfileEventSummary[];
}

export interface PublicProfile {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  final_score: number | null;
  host_rating_count: number;
  participant_rating_count: number;
  equipment: EquipmentItem[];
  showcase_images: ShowcaseImageItem[];
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

export interface CreateEquipmentRequest {
  name: string;
  description?: string | null;
  image_url?: string | null;
}

export interface UpdateEquipmentRequest {
  name?: string | null;
  description?: string | null;
  image_url?: string | null;
}
