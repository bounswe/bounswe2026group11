package ticket

import (
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

const (
	ScanResultAccepted = "ACCEPTED"
	ScanResultRejected = "REJECTED"

	RejectReasonInvalidToken          = "INVALID_TOKEN"
	RejectReasonTicketNotFound        = "TICKET_NOT_FOUND"
	RejectReasonTicketAlreadyUsed     = "TICKET_ALREADY_USED"
	RejectReasonTicketNotActive       = "TICKET_NOT_ACTIVE"
	RejectReasonParticipationInvalid  = "PARTICIPATION_INVALID"
	RejectReasonEventInvalid          = "EVENT_INVALID"
	RejectReasonTokenOldVersion       = "TOKEN_OLD_VERSION" // #nosec G101 -- wire rejection reason, not a secret
	RejectReasonTokenNotLatest        = "TOKEN_NOT_LATEST"
	RejectReasonEventMismatch         = "EVENT_MISMATCH"
	RejectReasonParticipationMismatch = "PARTICIPATION_MISMATCH"
)

// QRTokenInput carries the caller's current location for QR issuance.
type QRTokenInput struct {
	Lat float64
	Lon float64
}

// QRTokenResult is the short-lived token payload sent over SSE.
type QRTokenResult struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	Version   int       `json:"version"`
}

// ScanTicketInput carries a scanned short-lived QR token.
type ScanTicketInput struct {
	QRToken string
}

// ScanTicketResult is returned to the host scanner flow.
type ScanTicketResult struct {
	Result          string               `json:"result"`
	Reason          *string              `json:"reason,omitempty"`
	TicketID        *string              `json:"ticket_id,omitempty"`
	ParticipationID *string              `json:"participation_id,omitempty"`
	UserID          *string              `json:"user_id,omitempty"`
	TicketStatus    *domain.TicketStatus `json:"ticket_status,omitempty"`
}

// ListTicketsResult wraps the caller's tickets.
type ListTicketsResult struct {
	Items []TicketListItem `json:"items"`
}

// TicketListItem is the compact ticket-card payload.
type TicketListItem struct {
	TicketID      string                  `json:"ticket_id"`
	Status        domain.TicketStatus     `json:"status"`
	ExpiresAt     time.Time               `json:"expires_at"`
	Event         TicketEventSummary      `json:"event"`
	Participation TicketParticipationInfo `json:"participation"`
}

// TicketDetailResult is the full ticket detail payload.
type TicketDetailResult struct {
	Ticket        TicketInfo              `json:"ticket"`
	Participation TicketParticipationInfo `json:"participation"`
	Event         TicketEventSummary      `json:"event"`
	Location      TicketLocationSummary   `json:"location"`
	QRAccess      QRAccessInfo            `json:"qr_access"`
}

// TicketInfo contains persisted ticket fields safe for clients.
type TicketInfo struct {
	ID        string              `json:"id"`
	Status    domain.TicketStatus `json:"status"`
	ExpiresAt time.Time           `json:"expires_at"`
	UsedAt    *time.Time          `json:"used_at,omitempty"`
	CreatedAt time.Time           `json:"created_at"`
	UpdatedAt time.Time           `json:"updated_at"`
}

// TicketParticipationInfo summarizes the linked participation.
type TicketParticipationInfo struct {
	ID     string                     `json:"id"`
	Status domain.ParticipationStatus `json:"status"`
}

// TicketEventSummary summarizes the linked event.
type TicketEventSummary struct {
	ID           string                   `json:"id"`
	Title        string                   `json:"title"`
	Status       domain.EventStatus       `json:"status"`
	PrivacyLevel domain.EventPrivacyLevel `json:"privacy_level"`
	StartTime    time.Time                `json:"start_time"`
	EndTime      *time.Time               `json:"end_time,omitempty"`
	LocationType domain.EventLocationType `json:"location_type"`
	Address      *string                  `json:"address"`
}

// TicketLocationSummary exposes the backend proximity anchor.
type TicketLocationSummary struct {
	Type      domain.EventLocationType `json:"type"`
	Address   *string                  `json:"address"`
	AnchorLat float64                  `json:"anchor_lat"`
	AnchorLon float64                  `json:"anchor_lon"`
}

// QRAccessInfo tells mobile whether QR streaming can be attempted.
type QRAccessInfo struct {
	RequiresLocationPermission bool    `json:"requires_location_permission"`
	RequiresProximity          bool    `json:"requires_proximity"`
	ProximityMeters            float64 `json:"proximity_meters"`
	EligibleNow                bool    `json:"eligible_now"`
	Reason                     *string `json:"reason,omitempty"`
}

// TicketRecord is the repository-level projection for ticket list/detail responses.
type TicketRecord struct {
	Ticket        domain.Ticket
	Participation domain.Participation
	EventID       uuid.UUID
	EventTitle    string
	EventStatus   domain.EventStatus
	PrivacyLevel  domain.EventPrivacyLevel
	StartTime     time.Time
	EndTime       *time.Time
	LocationType  domain.EventLocationType
	Address       *string
	Anchor        domain.GeoPoint
}

// TicketAccessRecord contains all state needed to issue a QR token.
type TicketAccessRecord struct {
	TicketRecord
	UserID         uuid.UUID
	DistanceMeters float64
}

// TicketScanRecord contains all state needed to accept or reject a scan.
type TicketScanRecord struct {
	Ticket        domain.Ticket
	Participation domain.Participation
	EventID       uuid.UUID
	EventStatus   domain.EventStatus
	PrivacyLevel  domain.EventPrivacyLevel
	HostID        uuid.UUID
	UserID        uuid.UUID
}

// QRTokenClaims is the signed short-lived ticket token payload.
type QRTokenClaims struct {
	TicketID        uuid.UUID
	ParticipationID uuid.UUID
	EventID         uuid.UUID
	UserID          uuid.UUID
	Version         int
	IssuedAt        time.Time
	ExpiresAt       time.Time
}
