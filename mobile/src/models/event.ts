export type PrivacyLevel = 'PUBLIC' | 'PROTECTED' | 'PRIVATE';

export type LocationType = 'POINT' | 'ROUTE';

export type PreferredGender = 'MALE' | 'FEMALE' | 'OTHER';

export interface EventConstraint {
  type: string;
  info: string;
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
  start_time: string;
  end_time?: string;
  capacity?: number;
  privacy_level: PrivacyLevel;
  tags?: string[];
  constraints?: EventConstraint[];
  minimum_age?: number;
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

export interface EventCategory {
  id: number;
  name: string;
}

export interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

export interface HostScore {
  final_score: number | null;
  hosted_event_rating_count: number;
}

export interface EventSummary {
  id: string;
  title: string;
  category_name: string;
  image_url?: string | null;
  start_time: string;
  location_address?: string | null;
  privacy_level: Extract<PrivacyLevel, 'PUBLIC' | 'PROTECTED'>;
  approved_participant_count: number;
  is_favorited: boolean;
  host_score: HostScore;
  capacity?: number;
  favorite_count?: number;
}

export type DiscoverEventsSortBy = 'START_TIME' | 'DISTANCE' | 'RELEVANCE';

export interface ListEventsQuery {
  lat: number;
  lon: number;
  radius_meters?: number;
  q?: string;
  privacy_levels?: Array<Extract<PrivacyLevel, 'PUBLIC' | 'PROTECTED'>>;
  category_ids?: number[];
  start_from?: string;
  start_to?: string;
  tag_names?: string[];
  only_favorited?: boolean;
  sort_by?: DiscoverEventsSortBy;
  limit?: number;
  cursor?: string;
}

export interface DiscoverEventsPageInfo {
  next_cursor: string | null;
  has_next: boolean;
}

export interface PaginatedEventsResponse {
  items: EventSummary[];
  page_info: DiscoverEventsPageInfo;
}

export interface ListCategoriesResponse {
  items: EventCategory[];
}