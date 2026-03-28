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
	ID                       string    `json:"id"`
	Title                    string    `json:"title"`
	CategoryName             string    `json:"category_name"`
	ImageURL                 *string   `json:"image_url"`
	StartTime                time.Time `json:"start_time"`
	LocationAddress          *string   `json:"location_address"`
	PrivacyLevel             string    `json:"privacy_level"`
	ApprovedParticipantCount int       `json:"approved_participant_count"`
	IsFavorited              bool      `json:"is_favorited"`
}

// DiscoverEventsPageInfo contains cursor pagination metadata.
type DiscoverEventsPageInfo struct {
	NextCursor *string `json:"next_cursor"`
	HasNext    bool    `json:"has_next"`
}

// JoinEventResult is returned after a user successfully joins a public event.
type JoinEventResult struct {
	ParticipationID string    `json:"participation_id"`
	EventID         string    `json:"event_id"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
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
