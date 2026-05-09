package admin

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Repository is the persistence port for read-only backoffice list queries.
type Repository interface {
	ListUsers(ctx context.Context, input ListUsersInput) (*ListUsersResult, error)
	ListEvents(ctx context.Context, input ListEventsInput) (*ListEventsResult, error)
	ListParticipations(ctx context.Context, input ListParticipationsInput) (*ListParticipationsResult, error)
	ListTickets(ctx context.Context, input ListTicketsInput) (*ListTicketsResult, error)
	ListNotifications(ctx context.Context, input ListNotificationsInput) (*ListNotificationsResult, error)
	ListEventReports(ctx context.Context, input ListEventReportsInput) (*ListEventReportsResult, error)
	ListCategories(ctx context.Context) (*ListCategoriesResult, error)
	CreateCategory(ctx context.Context, name string) (*AdminCategoryItem, error)
	DeleteCategory(ctx context.Context, categoryID int) error
	UpdateEventReportStatus(ctx context.Context, reportID uuid.UUID, status domain.EventReportStatus) (*AdminEventReportItem, error)
	UpdateEventStatus(ctx context.Context, eventID uuid.UUID, status domain.EventStatus) (*AdminEventItem, error)
	CancelEvent(ctx context.Context, eventID uuid.UUID) (alreadyCanceled bool, err error)
	CancelEventParticipations(ctx context.Context, eventID uuid.UUID) error
	CancelPendingInvitationsForEvent(ctx context.Context, eventID uuid.UUID) error
	CancelPendingJoinRequestsForEvent(ctx context.Context, eventID uuid.UUID) error
	GetUserStatus(ctx context.Context, userID uuid.UUID, forUpdate bool) (*domain.UserStatus, error)
	DeactivateUser(ctx context.Context, userID uuid.UUID) error
	RevokeRefreshTokensForUser(ctx context.Context, userID uuid.UUID) error
	RevokePushDevicesForUser(ctx context.Context, userID uuid.UUID) error
	ListHostedCancelableEventIDs(ctx context.Context, hostID uuid.UUID) ([]uuid.UUID, error)
	CancelUserParticipations(ctx context.Context, userID uuid.UUID) error
	CancelUserTickets(ctx context.Context, userID uuid.UUID) error
	CancelPendingInvitationsForUser(ctx context.Context, userID uuid.UUID) error
	CancelPendingJoinRequestsForUser(ctx context.Context, userID uuid.UUID) error
	ListInvitations(ctx context.Context, input ListInvitationsInput) (*ListInvitationsResult, error)
	UpdateInvitationStatus(ctx context.Context, invitationID uuid.UUID, status domain.InvitationStatus) (*AdminInvitationItem, error)
	ListJoinRequests(ctx context.Context, input ListJoinRequestsInput) (*ListJoinRequestsResult, error)
	UpdateJoinRequestStatus(ctx context.Context, joinRequestID uuid.UUID, status domain.JoinRequestStatus) (*AdminJoinRequestItem, error)
	ListComments(ctx context.Context, input ListCommentsInput) (*ListCommentsResult, error)
	DeleteComment(ctx context.Context, commentID uuid.UUID) error
	ListEventRatings(ctx context.Context, input ListEventRatingsInput) (*ListEventRatingsResult, error)
	ListParticipantRatings(ctx context.Context, input ListParticipantRatingsInput) (*ListParticipantRatingsResult, error)
	DeleteEventRating(ctx context.Context, ratingID uuid.UUID) error
	DeleteParticipantRating(ctx context.Context, ratingID uuid.UUID) error
	ListFavoriteEvents(ctx context.Context, input ListFavoriteEventsInput) (*ListFavoriteEventsResult, error)
	ListFavoriteLocations(ctx context.Context, input ListFavoriteLocationsInput) (*ListFavoriteLocationsResult, error)
	ListUserBadges(ctx context.Context, input ListUserBadgesInput) (*ListUserBadgesResult, error)
	ListPushDevices(ctx context.Context, input ListPushDevicesInput) (*ListPushDevicesResult, error)
	RevokePushDevice(ctx context.Context, deviceID uuid.UUID) error
	CountExistingUsers(ctx context.Context, userIDs []uuid.UUID) (int, error)
	GetEventState(ctx context.Context, eventID uuid.UUID, forUpdate bool) (*AdminEventState, error)
	CreateManualParticipation(ctx context.Context, eventID, userID uuid.UUID, status domain.ParticipationStatus) (*domain.Participation, error)
	GetParticipationByID(ctx context.Context, participationID uuid.UUID, forUpdate bool) (*domain.Participation, error)
	CancelParticipation(ctx context.Context, participationID uuid.UUID) (*domain.Participation, bool, error)
}
