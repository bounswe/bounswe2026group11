package admin

import "context"

// UseCase exposes read-only backoffice list operations.
type UseCase interface {
	ListUsers(ctx context.Context, input ListUsersInput) (*ListUsersResult, error)
	ListEvents(ctx context.Context, input ListEventsInput) (*ListEventsResult, error)
	ListParticipations(ctx context.Context, input ListParticipationsInput) (*ListParticipationsResult, error)
	ListTickets(ctx context.Context, input ListTicketsInput) (*ListTicketsResult, error)
	ListNotifications(ctx context.Context, input ListNotificationsInput) (*ListNotificationsResult, error)
	ListEventReports(ctx context.Context, input ListEventReportsInput) (*ListEventReportsResult, error)
	ListCategories(ctx context.Context) (*ListCategoriesResult, error)
	CreateCategory(ctx context.Context, input CreateCategoryInput) (*AdminCategoryItem, error)
	DeleteCategory(ctx context.Context, input DeleteCategoryInput) error
	UpdateEventReportStatus(ctx context.Context, input UpdateEventReportStatusInput) (*AdminEventReportItem, error)
	UpdateEventStatus(ctx context.Context, input UpdateEventStatusInput) (*AdminEventItem, error)
	CancelEvent(ctx context.Context, input CancelEventInput) (*CancelEventResult, error)
	DeactivateUser(ctx context.Context, input DeactivateUserInput) (*DeactivateUserResult, error)
	ListInvitations(ctx context.Context, input ListInvitationsInput) (*ListInvitationsResult, error)
	UpdateInvitationStatus(ctx context.Context, input UpdateInvitationStatusInput) (*AdminInvitationItem, error)
	ListJoinRequests(ctx context.Context, input ListJoinRequestsInput) (*ListJoinRequestsResult, error)
	UpdateJoinRequestStatus(ctx context.Context, input UpdateJoinRequestStatusInput) (*AdminJoinRequestItem, error)
	ListComments(ctx context.Context, input ListCommentsInput) (*ListCommentsResult, error)
	DeleteComment(ctx context.Context, input DeleteCommentInput) error
	ListEventRatings(ctx context.Context, input ListEventRatingsInput) (*ListEventRatingsResult, error)
	ListParticipantRatings(ctx context.Context, input ListParticipantRatingsInput) (*ListParticipantRatingsResult, error)
	DeleteEventRating(ctx context.Context, input DeleteRatingInput) error
	DeleteParticipantRating(ctx context.Context, input DeleteRatingInput) error
	ListFavoriteEvents(ctx context.Context, input ListFavoriteEventsInput) (*ListFavoriteEventsResult, error)
	ListFavoriteLocations(ctx context.Context, input ListFavoriteLocationsInput) (*ListFavoriteLocationsResult, error)
	ListUserBadges(ctx context.Context, input ListUserBadgesInput) (*ListUserBadgesResult, error)
	ListPushDevices(ctx context.Context, input ListPushDevicesInput) (*ListPushDevicesResult, error)
	RevokePushDevice(ctx context.Context, input RevokePushDeviceInput) error
	SendCustomNotification(ctx context.Context, input SendCustomNotificationInput) (*SendCustomNotificationResult, error)
	CreateManualParticipation(ctx context.Context, input CreateManualParticipationInput) (*CreateManualParticipationResult, error)
	CancelParticipation(ctx context.Context, input CancelParticipationInput) (*CancelParticipationResult, error)
}
