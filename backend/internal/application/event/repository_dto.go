package event

import (
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// CreateEventParams carries all data needed to persist a new event and its
// related location, tags, and constraints in a single transaction.
type CreateEventParams struct {
	HostID          uuid.UUID
	Title           string
	Description     string
	ImageURL        *string
	CategoryID      int
	StartTime       time.Time
	EndTime         *time.Time
	PrivacyLevel    domain.EventPrivacyLevel
	Capacity        *int
	MinimumAge      *int
	PreferredGender *domain.EventParticipantGender
	LocationType    domain.EventLocationType
	Address         *string
	Point           *domain.GeoPoint
	RoutePoints     []domain.GeoPoint
	Tags            []string
	Constraints     []EventConstraintParams
}

// EventConstraintParams is a single constraint to attach to an event.
type EventConstraintParams struct {
	Type string
	Info string
}

// DiscoverEventsParams carries the normalized discovery filters and pagination state.
type DiscoverEventsParams struct {
	Origin               domain.GeoPoint
	RadiusMeters         int
	Query                string
	SearchTSQuery        string
	PrivacyLevels        []domain.EventPrivacyLevel
	CategoryIDs          []int
	StartFrom            *time.Time
	StartTo              *time.Time
	TagNames             []string
	OnlyFavorited        bool
	SortBy               domain.EventDiscoverySort
	Limit                int
	CursorToken          string
	FilterFingerprint    string
	DecodedCursor        *DiscoverEventsCursor
	RepositoryFetchLimit int
}

// DiscoverableEventRecord is the repository-level projection used for discovery responses.
type DiscoverableEventRecord struct {
	ID                       uuid.UUID
	Title                    string
	CategoryName             string
	ImageURL                 *string
	StartTime                time.Time
	LocationAddress          *string
	PrivacyLevel             domain.EventPrivacyLevel
	ApprovedParticipantCount int
	IsFavorited              bool
	DistanceMeters           float64
	RelevanceScore           *float64
}

// DiscoverEventsCursor is the opaque keyset cursor payload used by discovery pagination.
type DiscoverEventsCursor struct {
	SortBy            domain.EventDiscoverySort `json:"sort_by"`
	FilterFingerprint string                    `json:"filter_fingerprint"`
	StartTime         time.Time                 `json:"start_time"`
	EventID           uuid.UUID                 `json:"event_id"`
	DistanceMeters    *float64                  `json:"distance_meters,omitempty"`
	RelevanceScore    *float64                  `json:"relevance_score,omitempty"`
}
