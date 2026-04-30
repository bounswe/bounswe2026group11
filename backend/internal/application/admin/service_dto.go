package admin

import (
	"context"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

const (
	DefaultLimit = 50
	MaxLimit     = 100
)

// PageInput carries offset pagination controls.
type PageInput struct {
	Limit  int
	Offset int
}

// PageMeta describes offset pagination state for table clients.
type PageMeta struct {
	Limit      int  `json:"limit"`
	Offset     int  `json:"offset"`
	TotalCount int  `json:"total_count"`
	HasNext    bool `json:"has_next"`
}

type CreatedRange struct {
	CreatedFrom *time.Time
	CreatedTo   *time.Time
}

type StartRange struct {
	StartFrom *time.Time
	StartTo   *time.Time
}

type ListUsersInput struct {
	PageInput
	CreatedRange
	Query  *string
	Status *domain.UserStatus
	Role   *domain.UserRole
}

type AdminUserItem struct {
	ID            uuid.UUID  `json:"id"`
	Username      string     `json:"username"`
	Email         string     `json:"email"`
	PhoneNumber   *string    `json:"phone_number"`
	EmailVerified bool       `json:"email_verified"`
	LastLogin     *time.Time `json:"last_login"`
	Status        string     `json:"status"`
	Role          string     `json:"role"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type ListUsersResult struct {
	Items []AdminUserItem `json:"items"`
	PageMeta
}

type ListEventsInput struct {
	PageInput
	StartRange
	Query        *string
	HostID       *uuid.UUID
	CategoryID   *int
	PrivacyLevel *domain.EventPrivacyLevel
	Status       *domain.EventStatus
}

type AdminEventItem struct {
	ID                       uuid.UUID  `json:"id"`
	HostID                   uuid.UUID  `json:"host_id"`
	HostUsername             string     `json:"host_username"`
	Title                    string     `json:"title"`
	CategoryID               *int       `json:"category_id"`
	CategoryName             *string    `json:"category_name"`
	StartTime                time.Time  `json:"start_time"`
	EndTime                  *time.Time `json:"end_time"`
	PrivacyLevel             string     `json:"privacy_level"`
	Status                   string     `json:"status"`
	Capacity                 *int       `json:"capacity"`
	ApprovedParticipantCount int        `json:"approved_participant_count"`
	PendingParticipantCount  int        `json:"pending_participant_count"`
	CreatedAt                time.Time  `json:"created_at"`
	UpdatedAt                time.Time  `json:"updated_at"`
}

type ListEventsResult struct {
	Items []AdminEventItem `json:"items"`
	PageMeta
}

type ListParticipationsInput struct {
	PageInput
	CreatedRange
	Query   *string
	Status  *domain.ParticipationStatus
	EventID *uuid.UUID
	UserID  *uuid.UUID
}

type AdminParticipationItem struct {
	ID            uuid.UUID  `json:"id"`
	EventID       uuid.UUID  `json:"event_id"`
	EventTitle    string     `json:"event_title"`
	UserID        uuid.UUID  `json:"user_id"`
	Username      string     `json:"username"`
	UserEmail     string     `json:"user_email"`
	Status        string     `json:"status"`
	ReconfirmedAt *time.Time `json:"reconfirmed_at"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type ListParticipationsResult struct {
	Items []AdminParticipationItem `json:"items"`
	PageMeta
}

type ListTicketsInput struct {
	PageInput
	CreatedRange
	Query           *string
	Status          *domain.TicketStatus
	EventID         *uuid.UUID
	UserID          *uuid.UUID
	ParticipationID *uuid.UUID
}

type AdminTicketItem struct {
	ID              uuid.UUID  `json:"id"`
	ParticipationID uuid.UUID  `json:"participation_id"`
	EventID         uuid.UUID  `json:"event_id"`
	EventTitle      string     `json:"event_title"`
	UserID          uuid.UUID  `json:"user_id"`
	Username        string     `json:"username"`
	UserEmail       string     `json:"user_email"`
	Status          string     `json:"status"`
	ExpiresAt       time.Time  `json:"expires_at"`
	UsedAt          *time.Time `json:"used_at"`
	CanceledAt      *time.Time `json:"canceled_at"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type ListTicketsResult struct {
	Items []AdminTicketItem `json:"items"`
	PageMeta
}

func (s *Service) ListUsers(ctx context.Context, input ListUsersInput) (*ListUsersResult, error) {
	return s.repo.ListUsers(ctx, input)
}

func (s *Service) ListEvents(ctx context.Context, input ListEventsInput) (*ListEventsResult, error) {
	return s.repo.ListEvents(ctx, input)
}

func (s *Service) ListParticipations(ctx context.Context, input ListParticipationsInput) (*ListParticipationsResult, error) {
	return s.repo.ListParticipations(ctx, input)
}

func (s *Service) ListTickets(ctx context.Context, input ListTicketsInput) (*ListTicketsResult, error) {
	return s.repo.ListTickets(ctx, input)
}
