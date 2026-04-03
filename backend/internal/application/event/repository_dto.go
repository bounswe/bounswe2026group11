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
	HostScore                EventHostScoreSummaryRecord
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

// FavoriteEventRecord is the repository-level projection for favorite event listings.
type FavoriteEventRecord struct {
	ID           uuid.UUID
	Title        string
	CategoryName *string
	ImageURL     *string
	Status       domain.EventStatus
	StartTime    time.Time
	EndTime      *time.Time
	FavoritedAt  time.Time
}

// EventDetailRecord is the repository-level projection used for event detail responses.
type EventDetailRecord struct {
	ID                       uuid.UUID
	Title                    string
	Description              *string
	ImageURL                 *string
	PrivacyLevel             domain.EventPrivacyLevel
	Status                   domain.EventStatus
	StartTime                time.Time
	EndTime                  *time.Time
	Capacity                 *int
	MinimumAge               *int
	PreferredGender          *domain.EventParticipantGender
	ApprovedParticipantCount int
	PendingParticipantCount  int
	FavoriteCount            int
	CreatedAt                time.Time
	UpdatedAt                time.Time
	Category                 *EventDetailCategoryRecord
	Host                     EventDetailPersonRecord
	HostScore                EventHostScoreSummaryRecord
	Location                 EventDetailLocationRecord
	Tags                     []string
	Constraints              []EventDetailConstraintRecord
	ViewerEventRating        *EventDetailRatingRecord
	ViewerContext            EventDetailViewerContextRecord
	HostContext              *EventDetailHostContextRecord
}

// EventDetailCategoryRecord is the category projection attached to an event detail payload.
type EventDetailCategoryRecord struct {
	ID   int
	Name string
}

// EventDetailPersonRecord is a safe user summary reused across event detail payloads.
type EventDetailPersonRecord struct {
	ID          uuid.UUID
	Username    string
	DisplayName *string
	AvatarURL   *string
}

// EventDetailHostContextUserRecord is the richer user summary shown only in
// host management lists.
type EventDetailHostContextUserRecord struct {
	ID          uuid.UUID
	Username    string
	DisplayName *string
	AvatarURL   *string
	FinalScore  *float64
	RatingCount int
}

// EventDetailLocationRecord carries the event geometry and address for the detail page.
type EventDetailLocationRecord struct {
	Type        domain.EventLocationType
	Address     *string
	Point       *domain.GeoPoint
	RoutePoints []domain.GeoPoint
}

// EventDetailConstraintRecord is a repository-level projection of an event constraint.
type EventDetailConstraintRecord struct {
	Type string
	Info string
}

// EventHostScoreSummaryRecord is the repository-level host score projection reused by event responses.
type EventHostScoreSummaryRecord struct {
	FinalScore             *float64
	HostedEventRatingCount int
}

// EventDetailRatingRecord is the shared repository-level rating snapshot used by detail responses.
type EventDetailRatingRecord struct {
	ID        uuid.UUID
	Rating    int
	Message   *string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// EventDetailViewerContextRecord captures the authenticated viewer's relation to the event.
type EventDetailViewerContextRecord struct {
	IsHost              bool
	IsFavorited         bool
	ParticipationStatus domain.EventDetailParticipationStatus
}

// EventDetailHostContextRecord contains host-only management lists for the event.
type EventDetailHostContextRecord struct {
	ApprovedParticipants []EventDetailApprovedParticipantRecord
	PendingJoinRequests  []EventDetailPendingJoinRequestRecord
	Invitations          []EventDetailInvitationRecord
}

// EventDetailApprovedParticipantRecord is a host-visible approved participation projection.
type EventDetailApprovedParticipantRecord struct {
	ParticipationID uuid.UUID
	Status          string
	CreatedAt       time.Time
	UpdatedAt       time.Time
	HostRating      *EventDetailRatingRecord
	User            EventDetailHostContextUserRecord
}

// EventDetailPendingJoinRequestRecord is a host-visible pending join request projection.
type EventDetailPendingJoinRequestRecord struct {
	JoinRequestID uuid.UUID
	Status        string
	Message       *string
	CreatedAt     time.Time
	UpdatedAt     time.Time
	User          EventDetailHostContextUserRecord
}

// EventDetailInvitationRecord is a host-visible invitation projection.
type EventDetailInvitationRecord struct {
	InvitationID uuid.UUID
	Status       domain.InvitationStatus
	Message      *string
	ExpiresAt    *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
	User         EventDetailHostContextUserRecord
}
