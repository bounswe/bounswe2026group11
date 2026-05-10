export type PrivacyLevel = 'PUBLIC' | 'PROTECTED' | 'PRIVATE';

export type LocationType = 'POINT' | 'ROUTE';

export type PreferredGender = 'MALE' | 'FEMALE' | 'OTHER';

export interface EventConstraint {
  type: string;
  info: string;
}

export interface RoutePointInput {
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
  route_points?: RoutePointInput[];
  start_time: string;
  end_time?: string;
  capacity?: number;
  privacy_level: PrivacyLevel;
  tags?: string[];
  constraints?: EventConstraint[];
  minimum_age?: number;
  preferred_gender?: PreferredGender;
}

export interface UpdateEventRequest {
  title?: string;
  description?: string | null;
  category_id?: number | null;
  address?: string | null;
  lat?: number;
  lon?: number;
  location_type?: LocationType;
  route_points?: RoutePointInput[];
  start_time?: string;
  end_time?: string | null;
  capacity?: number | null;
  constraints?: EventConstraint[];
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
  location_lat?: number | null;
  location_lon?: number | null;
  privacy_level: PrivacyLevel;
  approved_participant_count: number;
  is_favorited: boolean;
  host_score: HostScore;
  capacity?: number;
  favorite_count?: number;
  status?: string;
  is_location_approximate?: boolean | null;
}

export type MyEventStatus =
  | 'ACTIVE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELED';

export type MyEventRelation = 'HOSTING' | 'ATTENDING';

export type MyEventBadgeType = 'HOST' | 'TICKET' | 'INVITED';

export type TicketStatus = 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'USED' | 'CANCELED';

export interface MyEventBadge {
  type: MyEventBadgeType;
  label: string;
}

export interface MyEventSummary {
  id: string;
  title: string;
  image_url?: string | null;
  start_time: string;
  end_time?: string | null;
  location_address?: string | null;
  approved_participant_count?: number | null;
  status: MyEventStatus;
  relation: MyEventRelation;
  privacy_level: PrivacyLevel;
  badges: MyEventBadge[];
  ticket_id?: string | null;
  ticket_status?: TicketStatus | null;
}

export interface MyEventsResponse {
  hosted_events: MyEventSummary[];
  attended_events: MyEventSummary[];
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
  meeting_instructions?: string | null;
  /** True when the backend has fuzzed the coordinates for a PROTECTED event. */
  is_location_approximate?: boolean;
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

export interface RatingWriteRequest {
  rating: number;
  message?: string | null;
}

export interface RatingResponse {
  id: string;
  rating: number;
  message?: string | null;
  created_at: string;
  updated_at: string;
}

export type ParticipationStatus = 'JOINED' | 'PENDING' | 'INVITED' | 'NONE' | 'LEAVED' | 'CANCELED';

export type JoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELED';

export interface EventDetailDiffChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

export interface EventDetailDiff {
  from_version_no: number;
  to_version_no: number;
  changed_fields: string[];
  changes: EventDetailDiffChange[];
}

export interface EventDetailViewerContext {
  is_host: boolean;
  is_favorited: boolean;
  participation_status: ParticipationStatus;
  join_request_status?: JoinRequestStatus | null;
  invitation_status?: InvitationStatus | null;
  needs_reconfirmation?: boolean;
  last_confirmed_event_version?: number | null;
  latest_event_version?: number;
  event_diff?: EventDetailDiff | null;
}

export interface EventDetailHostContextUser {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  final_score?: number | null;
  rating_count: number;
}

export interface EventDetailApprovedParticipant {
  participation_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  host_rating?: EventDetailEmbeddedRating | null;
  user: EventDetailHostContextUser;
}

export interface EventDetailPendingJoinRequest {
  join_request_id: string;
  status: string;
  message?: string | null;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
  user: EventDetailHostContextUser;
}

export interface EventDetailInvitation {
  invitation_id: string;
  status: string;
  message?: string | null;
  expires_at?: string | null;
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
  next_cursor?: string | null;
  has_next: boolean;
}

export interface EventDetail {
  id: string;
  version_no?: number;
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

export interface JoinEventResponse {
  participation_id: string;
  event_id: string;
  status: string;
  created_at: string;
}

export interface RequestJoinRequest {
  message?: string | null;
  image_confirm_token?: string | null;
}

export interface RequestJoinResponse {
  join_request_id: string;
  event_id: string;
  status: string;
  image_url?: string | null;
  created_at: string;
}

export interface LeaveEventResponse {
  participation_id: string;
  event_id: string;
  status: string;
  updated_at: string;
}

export interface ReconfirmParticipationResponse {
  participation_id: string;
  event_id: string;
  status: 'APPROVED';
  reconfirmed_at: string;
  updated_at: string;
  last_confirmed_event_version: number;
  latest_event_version: number;
  ticket_status?: TicketStatus;
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
  sortBy: Extract<DiscoverEventsSortBy, 'START_TIME' | 'DISTANCE'>;
}

// Image upload types (presigned URL flow)

export interface PresignedUpload {
  variant: 'ORIGINAL' | 'SMALL';
  method: string;
  url: string;
  headers: Record<string, string>;
}

export interface ImageUploadInitResponse {
  base_url: string;
  version: number;
  confirm_token: string;
  uploads: PresignedUpload[];
}

export enum EventReportCategory {
  SAFETY = 'SAFETY',
  HARASSMENT = 'HARASSMENT',
  SPAM_OR_SCAM = 'SPAM_OR_SCAM',
  INAPPROPRIATE_CONTENT = 'INAPPROPRIATE_CONTENT',
  EVENT_NOT_AS_DESCRIBED = 'EVENT_NOT_AS_DESCRIBED',
  ILLEGAL_OR_DANGEROUS = 'ILLEGAL_OR_DANGEROUS',
  OTHER = 'OTHER',
}

export interface RequestReportEvent {
  report_category: EventReportCategory;
  message: string;
  image_confirm_token?: string | null;
}

export interface ReportEventResponse {
  id: string;
  event_id: string;
  reporter_id: string;
  category: EventReportCategory;
  message: string;
  image_url?: string | null;
  created_at: string;
}
