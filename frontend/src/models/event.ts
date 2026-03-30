export type PrivacyLevel = 'PUBLIC' | 'PROTECTED' | 'PRIVATE';
export type LocationType = 'POINT' | 'ROUTE';
export type PreferredGender = 'MALE' | 'FEMALE' | 'OTHER';

export interface EventConstraint {
  type: string;
  info: string;
}

export interface RoutePoint {
  lat: number;
  lon: number;
}

export interface CreateEventRequest {
  title: string;
  description: string;
  image_url?: string;
  category_id: number;
  address?: string;
  lat?: number;
  lon?: number;
  location_type: LocationType;
  route_points?: RoutePoint[];
  start_time: string;
  end_time?: string;
  capacity?: number;
  privacy_level: PrivacyLevel;
  tags?: string[];
  constraints?: EventConstraint[];
  minimum_age?: number;
  maximum_age?: number;
  preferred_gender?: PreferredGender;
}

export interface CreateEventResponse {
  id: string;
  title: string;
  privacy_level: PrivacyLevel;
  status: string;
  start_time: string;
  end_time?: string;
  created_at: string;
}

export interface CategoryItem {
  id: number;
  name: string;
}

export interface ListCategoriesResponse {
  items: CategoryItem[];
}

export interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

/* ── Discovery ── */

export type DiscoverSortBy = 'START_TIME' | 'DISTANCE' | 'RELEVANCE';

export interface DiscoverEventsParams {
  lat: number;
  lon: number;
  radius_meters?: number;
  q?: string;
  privacy_levels?: string;
  category_ids?: string;
  start_from?: string;
  start_to?: string;
  tag_names?: string;
  only_favorited?: boolean;
  sort_by?: DiscoverSortBy;
  limit?: number;
  cursor?: string;
}

export interface HostScoreSummary {
  final_score: number | null;
  hosted_event_rating_count: number;
}

export interface DiscoverEventItem {
  id: string;
  title: string;
  category_name: string;
  image_url: string | null;
  start_time: string;
  location_address: string | null;
  privacy_level: 'PUBLIC' | 'PROTECTED';
  approved_participant_count: number;
  is_favorited: boolean;
  host_score: HostScoreSummary;
}

export interface DiscoverPageInfo {
  next_cursor: string | null;
  has_next: boolean;
}

export interface DiscoverEventsResponse {
  items: DiscoverEventItem[];
  page_info: DiscoverPageInfo;
}
