package domain

import (
	"time"

	"github.com/google/uuid"
)

// TicketStatus defines the lifecycle state of a protected-event entry ticket.
type TicketStatus string

const (
	// TicketStatusActive means the participant can request short-lived QR tokens.
	TicketStatusActive TicketStatus = "ACTIVE"
	// TicketStatusPending is reserved for future event re-approval flows.
	TicketStatusPending TicketStatus = "PENDING"
	// TicketStatusExpired marks an unused ticket whose event access window is over.
	TicketStatusExpired TicketStatus = "EXPIRED"
	// TicketStatusUsed marks a ticket accepted by a host scan.
	TicketStatusUsed TicketStatus = "USED"
	// TicketStatusCanceled marks a ticket canceled by leave/cancel flows.
	TicketStatusCanceled TicketStatus = "CANCELED"
)

var ticketStatuses = map[string]TicketStatus{
	string(TicketStatusActive):   TicketStatusActive,
	string(TicketStatusPending):  TicketStatusPending,
	string(TicketStatusExpired):  TicketStatusExpired,
	string(TicketStatusUsed):     TicketStatusUsed,
	string(TicketStatusCanceled): TicketStatusCanceled,
}

// ParseTicketStatus converts a wire or persistence string into a domain status.
func ParseTicketStatus(value string) (TicketStatus, bool) {
	status, ok := ticketStatuses[value]
	return status, ok
}

// String returns the serialized wire value of the ticket status.
func (s TicketStatus) String() string {
	return string(s)
}

// Ticket is the protected-event access entity linked to a participation.
type Ticket struct {
	ID                    uuid.UUID
	ParticipationID       uuid.UUID
	Status                TicketStatus
	QRTokenVersion        int
	LastIssuedQRTokenHash *string
	ExpiresAt             time.Time
	UsedAt                *time.Time
	CanceledAt            *time.Time
	CreatedAt             time.Time
	UpdatedAt             time.Time
}
