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

type ListNotificationsInput struct {
	PageInput
	CreatedRange
	Query   *string
	UserID  *uuid.UUID
	EventID *uuid.UUID
	Type    *string
	IsRead  *bool
}

type AdminNotificationItem struct {
	ID              uuid.UUID         `json:"id"`
	ReceiverUserID  uuid.UUID         `json:"receiver_user_id"`
	Username        string            `json:"username"`
	UserEmail       string            `json:"user_email"`
	EventID         *uuid.UUID        `json:"event_id"`
	EventTitle      *string           `json:"event_title"`
	Title           string            `json:"title"`
	Type            *string           `json:"type"`
	Body            string            `json:"body"`
	DeepLink        *string           `json:"deep_link"`
	Data            map[string]string `json:"data"`
	IsRead          bool              `json:"is_read"`
	ReadAt          *time.Time        `json:"read_at"`
	DeletedAt       *time.Time        `json:"deleted_at"`
	SSESentCount    int               `json:"sse_sent_count"`
	PushSentCount   int               `json:"push_sent_count"`
	PushFailedCount int               `json:"push_failed_count"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}

type ListNotificationsResult struct {
	Items []AdminNotificationItem `json:"items"`
	PageMeta
}

type SendCustomNotificationInput struct {
	AdminUserID    uuid.UUID
	UserIDs        []uuid.UUID
	DeliveryMode   domain.NotificationDeliveryMode
	Title          string
	Body           string
	Type           *string
	DeepLink       *string
	EventID        *uuid.UUID
	Data           map[string]string
	IdempotencyKey *string
}

type SendCustomNotificationResult struct {
	TargetUserCount       int `json:"target_user_count"`
	CreatedCount          int `json:"created_count"`
	IdempotentCount       int `json:"idempotent_count"`
	SSEDeliveryCount      int `json:"sse_delivery_count"`
	PushActiveDeviceCount int `json:"push_active_device_count"`
	PushSentCount         int `json:"push_sent_count"`
	PushFailedCount       int `json:"push_failed_count"`
	InvalidTokenCount     int `json:"invalid_token_count"`
}

type CreateManualParticipationInput struct {
	AdminUserID uuid.UUID
	EventID     uuid.UUID
	UserID      uuid.UUID
	Status      domain.ParticipationStatus
	Reason      *string
}

type CreateManualParticipationResult struct {
	ParticipationID uuid.UUID                  `json:"participation_id"`
	EventID         uuid.UUID                  `json:"event_id"`
	UserID          uuid.UUID                  `json:"user_id"`
	Status          domain.ParticipationStatus `json:"status"`
	TicketID        *uuid.UUID                 `json:"ticket_id,omitempty"`
	TicketStatus    *domain.TicketStatus       `json:"ticket_status,omitempty"`
}

type CancelParticipationInput struct {
	AdminUserID     uuid.UUID
	ParticipationID uuid.UUID
	Reason          *string
}

type CancelParticipationResult struct {
	ParticipationID uuid.UUID                  `json:"participation_id"`
	EventID         uuid.UUID                  `json:"event_id"`
	UserID          uuid.UUID                  `json:"user_id"`
	Status          domain.ParticipationStatus `json:"status"`
	AlreadyCanceled bool                       `json:"already_canceled"`
}

type AdminEventState struct {
	ID           uuid.UUID
	PrivacyLevel domain.EventPrivacyLevel
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

func (s *Service) ListNotifications(ctx context.Context, input ListNotificationsInput) (*ListNotificationsResult, error) {
	return s.repo.ListNotifications(ctx, input)
}
