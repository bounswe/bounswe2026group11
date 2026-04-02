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
  end_time?: string | null;
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


export interface EventDetailCategory {
  id: number;
  name: string;
}

export interface EventDetailUserSummary {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

export interface EventDetailPoint {
  lat: number;
  lon: number;
}

export interface EventDetailLocation {
  type: LocationType;
  address?: string | null;
  point?: EventDetailPoint | null;
  route_points?: EventDetailPoint[];
}

export interface EventDetailRatingWindow {
  opens_at: string;
  closes_at: string;
  is_active: boolean;
}

export interface EventDetailEmbeddedRating {
  id: string;
  rating: number;
  message?: string | null;
  created_at: string;
  updated_at: string;
}

export type ParticipationStatus = 'JOINED' | 'PENDING' | 'INVITED' | 'NONE';

export interface EventDetailViewerContext {
  is_host: boolean;
  is_favorited: boolean;
  participation_status: ParticipationStatus;
}

export interface EventDetail {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  privacy_level: PrivacyLevel;
  status: string;
  start_time: string;
  end_time?: string | null;
  capacity?: number | null;
  minimum_age?: number | null;
  preferred_gender?: string | null;
  approved_participant_count: number;
  pending_participant_count: number;
  favorite_count: number;
  created_at: string;
  updated_at: string;
  category?: EventDetailCategory | null;
  host: EventDetailUserSummary;
  host_score: HostScore;
  location: EventDetailLocation;
  tags: string[];
  constraints: EventConstraint[];
  rating_window: EventDetailRatingWindow;
  viewer_event_rating?: EventDetailEmbeddedRating | null;
  viewer_context: EventDetailViewerContext;
}

export interface JoinEventResponse {
  participation_id: string;
  event_id: string;
  status: string;
  created_at: string;
}

export interface RequestJoinRequest {
  message?: string | null;
}

export interface RequestJoinResponse {
  join_request_id: string;
  event_id: string;
  status: string;
  created_at: string;
}
export type HomeFilterPrivacyLevel = Extract<
  PrivacyLevel,
  'PUBLIC' | 'PROTECTED'
>;

export interface HomeFiltersDraft {
  categoryIds: number[];
  privacyLevels: HomeFilterPrivacyLevel[];
  startDate: string;
  endDate: string;
  radiusKm: number;

}