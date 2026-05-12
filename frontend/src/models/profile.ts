export interface EventSummary {
  id: string;
  title: string;
  start_time: string;
  end_time?: string | null;
  status: string;
  category?: string;
  category_name?: string;
  image_url?: string | null;
  location_address?: string | null;
  privacy_level?: 'PUBLIC' | 'PROTECTED' | 'PRIVATE';
  approved_participant_count?: number;
  participants_count?: number;
  host_score?: {
    final_score: number | null;
    hosted_event_rating_count: number;
  };
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  phone_number?: string;
  gender?: string;
  birth_date?: string;
  email_verified: boolean;
  status: string;
  default_location_address?: string;
  default_location_lat?: number;
  default_location_lon?: number;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  locale?: string | null;
}

export interface ProfileEquipmentItem {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
}

export interface ShowcaseImageItem {
  id: string;
  image_url: string;
}

export interface PublicProfile {
  user_id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  final_score?: number | null;
  host_rating_count: number;
  participant_rating_count: number;
  equipment: ProfileEquipmentItem[];
  showcase_images: ShowcaseImageItem[];
}

export interface UpdateProfileRequest {
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  default_location_address?: string | null;
  default_location_lat?: number | null;
  default_location_lon?: number | null;
  locale?: string | null;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

/* ── Favorite Locations ── */

export interface FavoriteLocation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
}

export interface FavoriteLocationsResponse {
  items: FavoriteLocation[];
}

export interface CreateFavoriteLocationRequest {
  name: string;
  address: string;
  lat: number;
  lon: number;
}

export interface UpdateFavoriteLocationRequest {
  name?: string;
  address?: string;
  lat?: number;
  lon?: number;
}

export interface ImageUploadInstruction {
  variant: 'ORIGINAL' | 'SMALL';
  method: 'PUT';
  url: string;
  headers: Record<string, string>;
}

export interface ImageUploadInitResponse {
  base_url: string;
  version: number;
  confirm_token: string;
  uploads: ImageUploadInstruction[];
}

export interface ImageUploadConfirmRequest {
  confirm_token: string;
}

export interface EquipmentListResponse {
  items: ProfileEquipmentItem[];
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

export type BadgeCategory = 'HOSTING' | 'PARTICIPATION' | 'SOCIAL';

export interface BadgeBase {
  slug: string;
  name: string;
  description: string;
  icon_url: string | null;
  category: BadgeCategory;
}

export interface EarnedBadge extends BadgeBase {
  earned_at: string;
}

export interface CatalogBadge extends BadgeBase {
  earned: boolean;
  earned_at: string | null;
}

export interface UserBadgesResponse {
  items: EarnedBadge[];
}

export interface BadgeCatalogResponse {
  items: CatalogBadge[];
}
