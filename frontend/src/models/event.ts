export type PrivacyLevel = 'PUBLIC' | 'PROTECTED' | 'PRIVATE';
export type LocationType = 'POINT' | 'ROUTE';
export type PreferredGender = 'MALE' | 'FEMALE' | 'OTHER';
export type EventReportCategory =
  | 'SPAM_OR_SCAM'
  | 'INAPPROPRIATE_CONTENT'
  | 'HARASSMENT';

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

export interface UpdateEventRequest {
  title?: string;
  description?: string | null;
  category_id?: number | null;
  address?: string | null;
  lat?: number;
  lon?: number;
  location_type?: LocationType;
  route_points?: RoutePoint[];
  start_time?: string;
  end_time?: string | null;
  capacity?: number | null;
  constraints?: EventConstraint[];
}

export interface UpdateEventResponse {
  id: string;
  title: string;
  privacy_level: PrivacyLevel;
  status: 'ACTIVE';
  start_time: string;
  end_time?: string | null;
  version_no: number;
  reconfirmation_required: boolean;
  reconfirmation_triggered_fields: string[];
  participants_marked_pending: number;
  updated_at: string;
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
  status: string;
  location_address: string | null;
  location_lat?: number;
  location_lon?: number;
  is_location_approximate: boolean;
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
  is_location_approximate: boolean;
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
  participation_status: 'APPROVED' | 'JOINED' | 'PENDING' | 'INVITED' | 'NONE' | 'LEAVED' | 'CANCELED' | null;
  join_request_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED' | null;
  invitation_status?: string | null;
  needs_reconfirmation?: boolean;
  last_confirmed_event_version?: number | null;
  latest_event_version?: number;
  event_diff?: EventVersionDiff | null;
}

export interface EventVersionChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

export interface EventVersionDiff {
  from_version_no: number;
  to_version_no: number;
  changed_fields: string[];
  changes: EventVersionChange[];
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
  image_url: string | null;
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

export interface EventHostContextSummary {
  approved_participant_count: number;
  pending_join_request_count: number;
  invitation_count: number;
}

export interface EventCollectionPageInfo {
  next_cursor: string | null;
  has_next: boolean;
}

export interface EventDetailResponse {
  id: string;
  version_no?: number;
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
  host_context?: EventDetailHostContext | null;
}

export interface EventApprovedParticipantsResponse {
  items: EventDetailApprovedParticipant[];
  page_info: EventCollectionPageInfo;
}

export interface EventPendingJoinRequestsResponse {
  items: EventDetailPendingJoinRequest[];
  page_info: EventCollectionPageInfo;
}

export interface EventInvitationsResponse {
  items: EventDetailInvitation[];
  page_info: EventCollectionPageInfo;
}

export interface RatingWriteRequest {
  rating: number;
  message?: string | null;
}

export type RatingResponse = EventDetailEmbeddedRating;

/* ── Join / Join Request ── */

export interface JoinEventResponse {
  participation_id: string;
  event_id: string;
  status: string;
  created_at: string;
}

export interface JoinRequestResponse {
  join_request_id: string;
  event_id: string;
  status: string;
  image_url?: string | null;
  created_at: string;
}

export interface RequestJoinRequestBody {
  message?: string;
  image_confirm_token?: string;
}

export interface ApproveJoinRequestResponse {
  join_request_id: string;
  event_id: string;
  join_request_status: string;
  participation_id: string;
  participation_status: string;
  updated_at: string;
}

export interface RejectJoinRequestResponse {
  join_request_id: string;
  event_id: string;
  status: string;
  updated_at: string;
  cooldown_ends_at: string;
}

export interface ReconfirmParticipationResponse {
  participation_id: string;
  event_id: string;
  status: string;
  reconfirmed_at: string;
  last_confirmed_event_version: number;
  latest_event_version: number;
}

export interface FavoriteEventItem {
  id: string;
  title: string;
  category: string | null;
  category_name?: string | null;
  image_url: string | null;
  status: string;
  start_time: string;
  end_time: string | null;
  favorited_at: string;
  location_address?: string | null;
  privacy_level?: 'PUBLIC' | 'PROTECTED' | 'PRIVATE' | null;
  approved_participant_count?: number;
  host_score?: HostScoreSummary | null;
}

export interface FavoriteEventsResponse {
  items: FavoriteEventItem[];
}

/* ── Comments (Discussion + Review) ── */

export type CommentType = 'DISCUSSION' | 'REVIEW';

export interface EventCommentAuthor {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface EventComment {
  id: string;
  event_id: string;
  user: EventCommentAuthor;
  comment_type: CommentType;
  message: string;
  parent_id: string | null;
  rating: number | null;
  image_url: string | null;
  likes_count: number;
  reply_count: number;
  created_at: string;
  updated_at: string;
}

export interface EventCommentPageInfo {
  next_cursor: string | null;
  has_next: boolean;
}

export interface EventCommentCollection {
  items: EventComment[];
  page_info: EventCommentPageInfo;
}

export interface EventCommentsResponse {
  discussion_comments: EventCommentCollection;
  review_comments: EventCommentCollection;
}

export interface ListEventCommentsParams {
  discussion_limit?: number;
  discussion_cursor?: string | null;
  review_limit?: number;
  review_cursor?: string | null;
}

export interface ListEventCommentRepliesParams {
  limit?: number;
  cursor?: string | null;
}

export interface CreateDiscussionCommentRequest {
  message: string;
  parent_id?: string | null;
}

export interface UpsertReviewCommentRequest {
  message: string;
  rating: number;
  image_confirm_token?: string | null;
}

/* ── Event Reports ── */

export interface CreateEventReportRequest {
  report_category: EventReportCategory;
  message: string;
  image_confirm_token?: string | null;
}

export interface EventReportResponse {
  id: string;
  event_id: string;
  reporter_user_id: string;
  report_category: EventReportCategory;
  message: string;
  image_url: string | null;
  status: 'PENDING' | 'REVIEWED' | 'DISMISSED';
  created_at: string;
}
