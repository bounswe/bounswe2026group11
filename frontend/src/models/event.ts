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

/* ── Event Detail ── */

export interface EventDetailCategory {
  id: number;
  name: string;
}

export interface EventDetailPoint {
  lat: number;
  lon: number;
}

export interface EventDetailLocation {
  type: 'POINT' | 'ROUTE';
  address: string | null;
  point: EventDetailPoint | null;
  route_points: EventDetailPoint[];
}

export interface EventDetailUserSummary {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface EventDetailConstraint {
  type: string;
  info: string;
}

export interface EventDetailRatingWindow {
  opens_at: string;
  closes_at: string;
  is_active: boolean;
}

export interface EventDetailEmbeddedRating {
  id: string;
  rating: number;
  message: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventDetailViewerContext {
  is_host: boolean;
  is_favorited: boolean;
  participation_status: 'JOINED' | 'PENDING' | 'INVITED' | 'NONE';
}

export interface EventDetailHostContextUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  final_score: number | null;
  rating_count: number;
}

export interface EventDetailApprovedParticipant {
  participation_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  host_rating: EventDetailEmbeddedRating | null;
  user: EventDetailHostContextUser;
}

export interface EventDetailPendingJoinRequest {
  join_request_id: string;
  status: string;
  message: string | null;
  created_at: string;
  updated_at: string;
  user: EventDetailHostContextUser;
}

export interface EventDetailInvitation {
  invitation_id: string;
  status: string;
  message: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  user: EventDetailHostContextUser;
}

export interface EventDetailHostContext {
  approved_participants: EventDetailApprovedParticipant[];
  pending_join_requests: EventDetailPendingJoinRequest[];
  invitations: EventDetailInvitation[];
}

export interface EventDetailResponse {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  privacy_level: 'PUBLIC' | 'PROTECTED' | 'PRIVATE';
  status: string;
  start_time: string;
  end_time: string | null;
  capacity: number | null;
  minimum_age: number | null;
  preferred_gender: string | null;
  approved_participant_count: number;
  pending_participant_count: number;
  favorite_count: number;
  created_at: string;
  updated_at: string;
  category: EventDetailCategory | null;
  host: EventDetailUserSummary;
  host_score: HostScoreSummary;
  location: EventDetailLocation;
  tags: string[];
  constraints: EventDetailConstraint[];
  rating_window: EventDetailRatingWindow;
  viewer_event_rating: EventDetailEmbeddedRating | null;
  viewer_context: EventDetailViewerContext;
  host_context: EventDetailHostContext | null;
}
