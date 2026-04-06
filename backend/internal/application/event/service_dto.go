package event

import (
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

// CreateEventInput is the validated input for creating an event.
type CreateEventInput struct {
	Title           string
	Description     *string
	ImageURL        *string
	CategoryID      *int
	Address         *string
	Lat             *float64
	Lon             *float64
	RoutePoints     []RoutePointInput
	LocationType    domain.EventLocationType
	StartTime       time.Time
	EndTime         *time.Time
	Capacity        *int
	PrivacyLevel    domain.EventPrivacyLevel
	Tags            []string
	Constraints     []ConstraintInput
	MinimumAge      *int
	PreferredGender *domain.EventParticipantGender
}

// ConstraintInput is a single constraint attached to an event.
type ConstraintInput struct {
	Type string
	Info string
}

// RoutePointInput is a single coordinate in a route geometry.
type RoutePointInput struct {
	Lat *float64
	Lon *float64
}

// CreateEventResult is returned after a successful event creation.
type CreateEventResult struct {
	ID           string     `json:"id"`
	Title        string     `json:"title"`
	PrivacyLevel string     `json:"privacy_level"`
	Status       string     `json:"status"`
	StartTime    time.Time  `json:"start_time"`
	EndTime      *time.Time `json:"end_time,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

// DiscoverEventsInput is the validated input for event discovery and search.
type DiscoverEventsInput struct {
	Lat           *float64
	Lon           *float64
	RadiusMeters  *int
	Query         *string
	PrivacyLevels []domain.EventPrivacyLevel
	CategoryIDs   []int
	StartFrom     *time.Time
	StartTo       *time.Time
	TagNames      []string
	OnlyFavorited bool
	SortBy        *domain.EventDiscoverySort
	Limit         *int
	Cursor        *string
}

// DiscoverEventsResult is returned after a successful event discovery query.
type DiscoverEventsResult struct {
	Items    []DiscoverableEventItem `json:"items"`
	PageInfo DiscoverEventsPageInfo  `json:"page_info"`
}

// DiscoverableEventItem is the compact event-card payload returned by discovery.
type DiscoverableEventItem struct {
	ID                       string                `json:"id"`
	Title                    string                `json:"title"`
	CategoryName             string                `json:"category_name"`
	ImageURL                 *string               `json:"image_url"`
	StartTime                time.Time             `json:"start_time"`
	Status                   string                `json:"status"`
	LocationAddress          *string               `json:"location_address"`
	PrivacyLevel             string                `json:"privacy_level"`
	ApprovedParticipantCount int                   `json:"approved_participant_count"`
	FavoriteCount            int                   `json:"favorite_count"`
	IsFavorited              bool                  `json:"is_favorited"`
	HostScore                EventHostScoreSummary `json:"host_score"`
}

// DiscoverEventsPageInfo contains cursor pagination metadata.
type DiscoverEventsPageInfo struct {
	NextCursor *string `json:"next_cursor"`
	HasNext    bool    `json:"has_next"`
}

// GetEventDetailResult is the full event payload used by the detail page.
type GetEventDetailResult struct {
	ID                       string                   `json:"id"`
	Title                    string                   `json:"title"`
	Description              *string                  `json:"description"`
	ImageURL                 *string                  `json:"image_url"`
	PrivacyLevel             string                   `json:"privacy_level"`
	Status                   string                   `json:"status"`
	StartTime                time.Time                `json:"start_time"`
	EndTime                  *time.Time               `json:"end_time"`
	Capacity                 *int                     `json:"capacity"`
	MinimumAge               *int                     `json:"minimum_age"`
	PreferredGender          *string                  `json:"preferred_gender"`
	ApprovedParticipantCount int                      `json:"approved_participant_count"`
	PendingParticipantCount  int                      `json:"pending_participant_count"`
	FavoriteCount            int                      `json:"favorite_count"`
	CreatedAt                time.Time                `json:"created_at"`
	UpdatedAt                time.Time                `json:"updated_at"`
	Category                 *EventDetailCategory     `json:"category"`
	Host                     EventDetailPerson        `json:"host"`
	HostScore                EventHostScoreSummary    `json:"host_score"`
	Location                 EventDetailLocation      `json:"location"`
	Tags                     []string                 `json:"tags"`
	Constraints              []EventDetailConstraint  `json:"constraints"`
	RatingWindow             EventDetailRatingWindow  `json:"rating_window"`
	ViewerEventRating        *EventDetailRating       `json:"viewer_event_rating"`
	ViewerContext            EventDetailViewerContext `json:"viewer_context"`
	HostContext              *EventDetailHostContext  `json:"host_context,omitempty"`
}

// EventDetailCategory is the category object returned by event detail responses.
type EventDetailCategory struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// EventDetailPerson is the safe user summary returned in event detail responses.
type EventDetailPerson struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName *string `json:"display_name"`
	AvatarURL   *string `json:"avatar_url"`
}

// EventDetailHostContextUser is the richer user summary returned only in
// host-only management lists.
type EventDetailHostContextUser struct {
	ID          string   `json:"id"`
	Username    string   `json:"username"`
	DisplayName *string  `json:"display_name"`
	AvatarURL   *string  `json:"avatar_url"`
	FinalScore  *float64 `json:"final_score"`
	RatingCount int      `json:"rating_count"`
}

// EventDetailLocation is the event location payload used by the detail page.
type EventDetailLocation struct {
	Type        string             `json:"type"`
	Address     *string            `json:"address"`
	Point       *EventDetailPoint  `json:"point,omitempty"`
	RoutePoints []EventDetailPoint `json:"route_points,omitempty"`
}

// EventDetailPoint is a single coordinate returned in event detail responses.
type EventDetailPoint struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

// EventDetailConstraint is a single event constraint returned by the detail endpoint.
type EventDetailConstraint struct {
	Type string `json:"type"`
	Info string `json:"info"`
}

// EventHostScoreSummary exposes the host's cached aggregate score on event payloads.
type EventHostScoreSummary struct {
	FinalScore             *float64 `json:"final_score"`
	HostedEventRatingCount int      `json:"hosted_event_rating_count"`
}

// EventDetailRatingWindow exposes the event-specific rating window bounds.
type EventDetailRatingWindow struct {
	OpensAt  time.Time `json:"opens_at"`
	ClosesAt time.Time `json:"closes_at"`
	IsActive bool      `json:"is_active"`
}

// EventDetailRating is a reusable rating snapshot embedded in detail responses.
type EventDetailRating struct {
	ID        string    `json:"id"`
	Rating    int       `json:"rating"`
	Message   *string   `json:"message"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// EventDetailViewerContext describes how the authenticated user relates to the event.
type EventDetailViewerContext struct {
	IsHost              bool   `json:"is_host"`
	IsFavorited         bool   `json:"is_favorited"`
	ParticipationStatus string `json:"participation_status"`
}

// EventDetailHostContext contains host-only management lists.
type EventDetailHostContext struct {
	ApprovedParticipants []EventDetailApprovedParticipant `json:"approved_participants"`
	PendingJoinRequests  []EventDetailPendingJoinRequest  `json:"pending_join_requests"`
	Invitations          []EventDetailInvitation          `json:"invitations"`
}

// EventDetailApprovedParticipant is returned only to the host.
type EventDetailApprovedParticipant struct {
	ParticipationID string                     `json:"participation_id"`
	Status          domain.ParticipationStatus `json:"status"`
	CreatedAt       time.Time                  `json:"created_at"`
	UpdatedAt       time.Time                  `json:"updated_at"`
	HostRating      *EventDetailRating         `json:"host_rating"`
	User            EventDetailHostContextUser `json:"user"`
}

// EventDetailPendingJoinRequest is returned only to the host.
type EventDetailPendingJoinRequest struct {
	JoinRequestID string                     `json:"join_request_id"`
	Status        string                     `json:"status"`
	Message       *string                    `json:"message"`
	CreatedAt     time.Time                  `json:"created_at"`
	UpdatedAt     time.Time                  `json:"updated_at"`
	User          EventDetailHostContextUser `json:"user"`
}

// EventDetailInvitation is returned only to the host.
type EventDetailInvitation struct {
	InvitationID string                     `json:"invitation_id"`
	Status       string                     `json:"status"`
	Message      *string                    `json:"message"`
	ExpiresAt    *time.Time                 `json:"expires_at"`
	CreatedAt    time.Time                  `json:"created_at"`
	UpdatedAt    time.Time                  `json:"updated_at"`
	User         EventDetailHostContextUser `json:"user"`
}

// FavoriteEventItem is the compact event summary returned by the favorites list.
type FavoriteEventItem struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Category    *string    `json:"category"`
	ImageURL    *string    `json:"image_url"`
	Status      string     `json:"status"`
	StartTime   time.Time  `json:"start_time"`
	EndTime     *time.Time `json:"end_time"`
	FavoritedAt time.Time  `json:"favorited_at"`
}

// FavoriteEventsResult wraps a list of favorite event items.
type FavoriteEventsResult struct {
	Items []FavoriteEventItem `json:"items"`
}

// JoinEventResult is returned after a user successfully joins a public event.
type JoinEventResult struct {
	ParticipationID string                     `json:"participation_id"`
	EventID         string                     `json:"event_id"`
	Status          domain.ParticipationStatus `json:"status"`
	CreatedAt       time.Time                  `json:"created_at"`
}

// LeaveEventResult is returned after a user successfully leaves an event.
type LeaveEventResult struct {
	ParticipationID string                     `json:"participation_id"`
	EventID         string                     `json:"event_id"`
	Status          domain.ParticipationStatus `json:"status"`
	UpdatedAt       time.Time                  `json:"updated_at"`
}

// RequestJoinInput is the validated input for creating a protected-event join request.
type RequestJoinInput struct {
	Message *string
}

// RequestJoinResult is returned after a user successfully creates a join request
// for a protected event.
type RequestJoinResult struct {
	JoinRequestID string    `json:"join_request_id"`
	EventID       string    `json:"event_id"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
}

// ApproveJoinRequestResult is returned after a host approves a join request.
type ApproveJoinRequestResult struct {
	JoinRequestID       string                     `json:"join_request_id"`
	EventID             string                     `json:"event_id"`
	JoinRequestStatus   string                     `json:"join_request_status"`
	ParticipationID     string                     `json:"participation_id"`
	ParticipationStatus domain.ParticipationStatus `json:"participation_status"`
	UpdatedAt           time.Time                  `json:"updated_at"`
}

// RejectJoinRequestResult is returned after a host rejects a join request.
type RejectJoinRequestResult struct {
	JoinRequestID  string    `json:"join_request_id"`
	EventID        string    `json:"event_id"`
	Status         string    `json:"status"`
	UpdatedAt      time.Time `json:"updated_at"`
	CooldownEndsAt time.Time `json:"cooldown_ends_at"`
}
