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

type ListEventReportsInput struct {
	PageInput
	CreatedRange
	Query          *string
	Status         *domain.EventReportStatus
	ReportCategory *domain.EventReportCategory
	EventID        *uuid.UUID
	ReporterUserID *uuid.UUID
}

type AdminEventReportItem struct {
	ID               uuid.UUID `json:"id"`
	EventID          uuid.UUID `json:"event_id"`
	EventTitle       *string   `json:"event_title"`
	ReporterUserID   uuid.UUID `json:"reporter_user_id"`
	ReporterUsername *string   `json:"reporter_username"`
	ReporterEmail    *string   `json:"reporter_email"`
	ReportCategory   string    `json:"report_category"`
	Message          string    `json:"message"`
	ImageURL         *string   `json:"image_url"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type ListEventReportsResult struct {
	Items []AdminEventReportItem `json:"items"`
	PageMeta
}

type AdminCategoryItem struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ListCategoriesResult struct {
	Items []AdminCategoryItem `json:"items"`
}

type CreateCategoryInput struct {
	AdminUserID uuid.UUID
	Name        string
}

type DeleteCategoryInput struct {
	AdminUserID uuid.UUID
	CategoryID  int
}

type UpdateEventReportStatusInput struct {
	AdminUserID uuid.UUID
	ReportID    uuid.UUID
	Status      domain.EventReportStatus
	Reason      *string
}

type UpdateEventStatusInput struct {
	AdminUserID uuid.UUID
	EventID     uuid.UUID
	Status      domain.EventStatus
	Reason      *string
}

type CancelEventInput struct {
	AdminUserID uuid.UUID
	EventID     uuid.UUID
	Reason      *string
}

type CancelEventResult struct {
	EventID         uuid.UUID          `json:"event_id"`
	Status          domain.EventStatus `json:"status"`
	AlreadyCanceled bool               `json:"already_canceled"`
}

type DeactivateUserInput struct {
	AdminUserID uuid.UUID
	UserID      uuid.UUID
	Reason      *string
}

type DeactivateUserResult struct {
	UserID             uuid.UUID         `json:"user_id"`
	Status             domain.UserStatus `json:"status"`
	AlreadyDeactivated bool              `json:"already_deactivated"`
	CanceledEventCount int               `json:"canceled_event_count"`
}

type ListInvitationsInput struct {
	PageInput
	CreatedRange
	Query         *string
	Status        *domain.InvitationStatus
	EventID       *uuid.UUID
	HostID        *uuid.UUID
	InvitedUserID *uuid.UUID
}

type AdminInvitationItem struct {
	ID              uuid.UUID  `json:"id"`
	EventID         uuid.UUID  `json:"event_id"`
	EventTitle      string     `json:"event_title"`
	HostID          uuid.UUID  `json:"host_id"`
	HostUsername    string     `json:"host_username"`
	InvitedUserID   uuid.UUID  `json:"invited_user_id"`
	InvitedUsername string     `json:"invited_username"`
	InvitedEmail    string     `json:"invited_email"`
	Status          string     `json:"status"`
	Message         *string    `json:"message"`
	ExpiresAt       *time.Time `json:"expires_at"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type ListInvitationsResult struct {
	Items []AdminInvitationItem `json:"items"`
	PageMeta
}

type UpdateInvitationStatusInput struct {
	AdminUserID  uuid.UUID
	InvitationID uuid.UUID
	Status       domain.InvitationStatus
	Reason       *string
}

type ListJoinRequestsInput struct {
	PageInput
	CreatedRange
	Query      *string
	Status     *domain.JoinRequestStatus
	EventID    *uuid.UUID
	UserID     *uuid.UUID
	HostUserID *uuid.UUID
}

type AdminJoinRequestItem struct {
	ID           uuid.UUID `json:"id"`
	EventID      uuid.UUID `json:"event_id"`
	EventTitle   string    `json:"event_title"`
	UserID       uuid.UUID `json:"user_id"`
	Username     string    `json:"username"`
	UserEmail    string    `json:"user_email"`
	HostUserID   uuid.UUID `json:"host_user_id"`
	HostUsername string    `json:"host_username"`
	Status       string    `json:"status"`
	Message      *string   `json:"message"`
	ImageURL     *string   `json:"image_url"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type ListJoinRequestsResult struct {
	Items []AdminJoinRequestItem `json:"items"`
	PageMeta
}

type UpdateJoinRequestStatusInput struct {
	AdminUserID   uuid.UUID
	JoinRequestID uuid.UUID
	Status        domain.JoinRequestStatus
	Reason        *string
}

type ListCommentsInput struct {
	PageInput
	CreatedRange
	Query   *string
	EventID *uuid.UUID
	UserID  *uuid.UUID
	Type    *string
}

type AdminCommentItem struct {
	ID         uuid.UUID  `json:"id"`
	EventID    uuid.UUID  `json:"event_id"`
	EventTitle string     `json:"event_title"`
	UserID     uuid.UUID  `json:"user_id"`
	Username   string     `json:"username"`
	UserEmail  string     `json:"user_email"`
	Type       string     `json:"type"`
	ParentID   *uuid.UUID `json:"parent_id"`
	Message    string     `json:"message"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

type ListCommentsResult struct {
	Items []AdminCommentItem `json:"items"`
	PageMeta
}

type DeleteCommentInput struct {
	AdminUserID uuid.UUID
	CommentID   uuid.UUID
	Reason      *string
}

type ListEventRatingsInput struct {
	PageInput
	CreatedRange
	EventID *uuid.UUID
	UserID  *uuid.UUID
}

type AdminEventRatingItem struct {
	ID                uuid.UUID `json:"id"`
	EventID           uuid.UUID `json:"event_id"`
	EventTitle        string    `json:"event_title"`
	ParticipantUserID uuid.UUID `json:"participant_user_id"`
	Username          string    `json:"username"`
	UserEmail         string    `json:"user_email"`
	Score             float64   `json:"score"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type ListEventRatingsResult struct {
	Items []AdminEventRatingItem `json:"items"`
	PageMeta
}

type ListParticipantRatingsInput struct {
	PageInput
	CreatedRange
	EventID *uuid.UUID
	HostID  *uuid.UUID
	UserID  *uuid.UUID
}

type AdminParticipantRatingItem struct {
	ID                  uuid.UUID `json:"id"`
	EventID             uuid.UUID `json:"event_id"`
	EventTitle          string    `json:"event_title"`
	HostUserID          uuid.UUID `json:"host_user_id"`
	HostUsername        string    `json:"host_username"`
	ParticipantUserID   uuid.UUID `json:"participant_user_id"`
	ParticipantUsername string    `json:"participant_username"`
	Score               float64   `json:"score"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type ListParticipantRatingsResult struct {
	Items []AdminParticipantRatingItem `json:"items"`
	PageMeta
}

type DeleteRatingInput struct {
	AdminUserID uuid.UUID
	RatingID    uuid.UUID
	Reason      *string
}

type ListFavoriteEventsInput struct {
	PageInput
	CreatedRange
	UserID  *uuid.UUID
	EventID *uuid.UUID
}

type AdminFavoriteEventItem struct {
	ID         uuid.UUID `json:"id"`
	UserID     uuid.UUID `json:"user_id"`
	Username   string    `json:"username"`
	UserEmail  string    `json:"user_email"`
	EventID    uuid.UUID `json:"event_id"`
	EventTitle string    `json:"event_title"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type ListFavoriteEventsResult struct {
	Items []AdminFavoriteEventItem `json:"items"`
	PageMeta
}

type ListFavoriteLocationsInput struct {
	PageInput
	CreatedRange
	UserID *uuid.UUID
	Query  *string
}

type AdminFavoriteLocationItem struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Username  string    `json:"username"`
	UserEmail string    `json:"user_email"`
	Name      *string   `json:"name"`
	Address   *string   `json:"address"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ListFavoriteLocationsResult struct {
	Items []AdminFavoriteLocationItem `json:"items"`
	PageMeta
}

type ListUserBadgesInput struct {
	PageInput
	UserID *uuid.UUID
	Query  *string
}

type AdminUserBadgeItem struct {
	UserID        uuid.UUID `json:"user_id"`
	Username      string    `json:"username"`
	UserEmail     string    `json:"user_email"`
	BadgeID       int       `json:"badge_id"`
	BadgeSlug     string    `json:"badge_slug"`
	BadgeName     string    `json:"badge_name"`
	BadgeCategory string    `json:"badge_category"`
	EarnedAt      time.Time `json:"earned_at"`
}

type ListUserBadgesResult struct {
	Items []AdminUserBadgeItem `json:"items"`
	PageMeta
}

type ListPushDevicesInput struct {
	PageInput
	CreatedRange
	UserID   *uuid.UUID
	Platform *string
	Active   *bool
}

type AdminPushDeviceItem struct {
	ID             uuid.UUID  `json:"id"`
	UserID         uuid.UUID  `json:"user_id"`
	Username       string     `json:"username"`
	UserEmail      string     `json:"user_email"`
	InstallationID uuid.UUID  `json:"installation_id"`
	Platform       string     `json:"platform"`
	LastSeenAt     time.Time  `json:"last_seen_at"`
	RevokedAt      *time.Time `json:"revoked_at"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type ListPushDevicesResult struct {
	Items []AdminPushDeviceItem `json:"items"`
	PageMeta
}

type RevokePushDeviceInput struct {
	AdminUserID uuid.UUID
	DeviceID    uuid.UUID
	Reason      *string
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
	ID                       uuid.UUID
	PrivacyLevel             domain.EventPrivacyLevel
	Capacity                 *int
	ApprovedParticipantCount int
	PendingParticipantCount  int
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

func (s *Service) ListEventReports(ctx context.Context, input ListEventReportsInput) (*ListEventReportsResult, error) {
	return s.repo.ListEventReports(ctx, input)
}

func (s *Service) ListCategories(ctx context.Context) (*ListCategoriesResult, error) {
	return s.repo.ListCategories(ctx)
}

func (s *Service) ListInvitations(ctx context.Context, input ListInvitationsInput) (*ListInvitationsResult, error) {
	return s.repo.ListInvitations(ctx, input)
}

func (s *Service) ListJoinRequests(ctx context.Context, input ListJoinRequestsInput) (*ListJoinRequestsResult, error) {
	return s.repo.ListJoinRequests(ctx, input)
}

func (s *Service) ListComments(ctx context.Context, input ListCommentsInput) (*ListCommentsResult, error) {
	return s.repo.ListComments(ctx, input)
}

func (s *Service) ListEventRatings(ctx context.Context, input ListEventRatingsInput) (*ListEventRatingsResult, error) {
	return s.repo.ListEventRatings(ctx, input)
}

func (s *Service) ListParticipantRatings(ctx context.Context, input ListParticipantRatingsInput) (*ListParticipantRatingsResult, error) {
	return s.repo.ListParticipantRatings(ctx, input)
}

func (s *Service) ListFavoriteEvents(ctx context.Context, input ListFavoriteEventsInput) (*ListFavoriteEventsResult, error) {
	return s.repo.ListFavoriteEvents(ctx, input)
}

func (s *Service) ListFavoriteLocations(ctx context.Context, input ListFavoriteLocationsInput) (*ListFavoriteLocationsResult, error) {
	return s.repo.ListFavoriteLocations(ctx, input)
}

func (s *Service) ListUserBadges(ctx context.Context, input ListUserBadgesInput) (*ListUserBadgesResult, error) {
	return s.repo.ListUserBadges(ctx, input)
}

func (s *Service) ListPushDevices(ctx context.Context, input ListPushDevicesInput) (*ListPushDevicesResult, error) {
	return s.repo.ListPushDevices(ctx, input)
}
