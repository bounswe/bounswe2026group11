package admin

import (
	"context"
	"testing"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/ticket"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

type fakeUnitOfWork struct {
	callCount int
}

func (u *fakeUnitOfWork) RunInTx(ctx context.Context, fn func(context.Context) error) error {
	u.callCount++
	return fn(ctx)
}

type fakeRepository struct {
	eventState    *AdminEventState
	participation *domain.Participation
	existingUsers int
}

func (r *fakeRepository) ListUsers(context.Context, ListUsersInput) (*ListUsersResult, error) {
	return nil, nil
}

func (r *fakeRepository) ListEvents(context.Context, ListEventsInput) (*ListEventsResult, error) {
	return nil, nil
}

func (r *fakeRepository) ListParticipations(context.Context, ListParticipationsInput) (*ListParticipationsResult, error) {
	return nil, nil
}

func (r *fakeRepository) ListTickets(context.Context, ListTicketsInput) (*ListTicketsResult, error) {
	return nil, nil
}

func (r *fakeRepository) ListNotifications(context.Context, ListNotificationsInput) (*ListNotificationsResult, error) {
	return nil, nil
}

func (r *fakeRepository) ListEventReports(context.Context, ListEventReportsInput) (*ListEventReportsResult, error) {
	return nil, nil
}

func (r *fakeRepository) ListCategories(context.Context) (*ListCategoriesResult, error) {
	return nil, nil
}
func (r *fakeRepository) CreateCategory(context.Context, string) (*AdminCategoryItem, error) {
	return nil, nil
}
func (r *fakeRepository) DeleteCategory(context.Context, int) error { return nil }
func (r *fakeRepository) UpdateEventReportStatus(context.Context, uuid.UUID, domain.EventReportStatus) (*AdminEventReportItem, error) {
	return nil, nil
}
func (r *fakeRepository) UpdateEventStatus(context.Context, uuid.UUID, domain.EventStatus) (*AdminEventItem, error) {
	return nil, nil
}
func (r *fakeRepository) CancelEvent(context.Context, uuid.UUID) (bool, error)       { return false, nil }
func (r *fakeRepository) CancelEventParticipations(context.Context, uuid.UUID) error { return nil }
func (r *fakeRepository) CancelPendingInvitationsForEvent(context.Context, uuid.UUID) error {
	return nil
}
func (r *fakeRepository) CancelPendingJoinRequestsForEvent(context.Context, uuid.UUID) error {
	return nil
}
func (r *fakeRepository) GetUserStatus(context.Context, uuid.UUID, bool) (*domain.UserStatus, error) {
	return nil, nil
}
func (r *fakeRepository) DeactivateUser(context.Context, uuid.UUID) error             { return nil }
func (r *fakeRepository) RevokeRefreshTokensForUser(context.Context, uuid.UUID) error { return nil }
func (r *fakeRepository) RevokePushDevicesForUser(context.Context, uuid.UUID) error   { return nil }
func (r *fakeRepository) ListHostedCancelableEventIDs(context.Context, uuid.UUID) ([]uuid.UUID, error) {
	return nil, nil
}
func (r *fakeRepository) CancelUserParticipations(context.Context, uuid.UUID) error { return nil }
func (r *fakeRepository) CancelUserTickets(context.Context, uuid.UUID) error        { return nil }
func (r *fakeRepository) CancelPendingInvitationsForUser(context.Context, uuid.UUID) error {
	return nil
}
func (r *fakeRepository) CancelPendingJoinRequestsForUser(context.Context, uuid.UUID) error {
	return nil
}
func (r *fakeRepository) ListInvitations(context.Context, ListInvitationsInput) (*ListInvitationsResult, error) {
	return nil, nil
}
func (r *fakeRepository) UpdateInvitationStatus(context.Context, uuid.UUID, domain.InvitationStatus) (*AdminInvitationItem, error) {
	return nil, nil
}
func (r *fakeRepository) ListJoinRequests(context.Context, ListJoinRequestsInput) (*ListJoinRequestsResult, error) {
	return nil, nil
}
func (r *fakeRepository) UpdateJoinRequestStatus(context.Context, uuid.UUID, domain.JoinRequestStatus) (*AdminJoinRequestItem, error) {
	return nil, nil
}
func (r *fakeRepository) ListComments(context.Context, ListCommentsInput) (*ListCommentsResult, error) {
	return nil, nil
}
func (r *fakeRepository) DeleteComment(context.Context, uuid.UUID) error { return nil }
func (r *fakeRepository) ListEventRatings(context.Context, ListEventRatingsInput) (*ListEventRatingsResult, error) {
	return nil, nil
}
func (r *fakeRepository) ListParticipantRatings(context.Context, ListParticipantRatingsInput) (*ListParticipantRatingsResult, error) {
	return nil, nil
}
func (r *fakeRepository) DeleteEventRating(context.Context, uuid.UUID) error       { return nil }
func (r *fakeRepository) DeleteParticipantRating(context.Context, uuid.UUID) error { return nil }
func (r *fakeRepository) ListFavoriteEvents(context.Context, ListFavoriteEventsInput) (*ListFavoriteEventsResult, error) {
	return nil, nil
}
func (r *fakeRepository) ListFavoriteLocations(context.Context, ListFavoriteLocationsInput) (*ListFavoriteLocationsResult, error) {
	return nil, nil
}
func (r *fakeRepository) ListUserBadges(context.Context, ListUserBadgesInput) (*ListUserBadgesResult, error) {
	return nil, nil
}
func (r *fakeRepository) ListPushDevices(context.Context, ListPushDevicesInput) (*ListPushDevicesResult, error) {
	return nil, nil
}
func (r *fakeRepository) RevokePushDevice(context.Context, uuid.UUID) error { return nil }

func (r *fakeRepository) CountExistingUsers(context.Context, []uuid.UUID) (int, error) {
	return r.existingUsers, nil
}

func (r *fakeRepository) GetEventState(context.Context, uuid.UUID, bool) (*AdminEventState, error) {
	return r.eventState, nil
}

func (r *fakeRepository) CreateManualParticipation(context.Context, uuid.UUID, uuid.UUID, domain.ParticipationStatus) (*domain.Participation, error) {
	return r.participation, nil
}

func (r *fakeRepository) GetParticipationByID(context.Context, uuid.UUID, bool) (*domain.Participation, error) {
	return nil, nil
}

func (r *fakeRepository) CancelParticipation(context.Context, uuid.UUID) (*domain.Participation, bool, error) {
	return nil, false, nil
}

type fakeTicketLifecycle struct {
	createCallCount   int
	lastParticipation *domain.Participation
	lastStatus        domain.TicketStatus
}

func (f *fakeTicketLifecycle) CreateTicketForParticipation(_ context.Context, participation *domain.Participation, status domain.TicketStatus) (*domain.Ticket, error) {
	f.createCallCount++
	f.lastParticipation = participation
	f.lastStatus = status
	return &domain.Ticket{ID: uuid.New(), ParticipationID: participation.ID, Status: status}, nil
}

func (f *fakeTicketLifecycle) CancelTicketForParticipation(context.Context, uuid.UUID) error {
	return nil
}

func (f *fakeTicketLifecycle) CancelTicketsForEvent(context.Context, uuid.UUID) error {
	return nil
}

func (f *fakeTicketLifecycle) ExpireTicketsForEvent(context.Context, uuid.UUID) error {
	return nil
}

func (f *fakeTicketLifecycle) MarkTicketsPendingForEvent(context.Context, uuid.UUID) error {
	return nil
}

func (f *fakeTicketLifecycle) ActivatePendingTicketsForEvent(context.Context, uuid.UUID) error {
	return nil
}

var _ ticket.LifecycleUseCase = (*fakeTicketLifecycle)(nil)

func TestCreateManualParticipationCreatesTicketForPublicApprovedParticipation(t *testing.T) {
	// given
	eventID := uuid.New()
	userID := uuid.New()
	participationID := uuid.New()
	repo := &fakeRepository{
		eventState: &AdminEventState{
			ID:           eventID,
			PrivacyLevel: domain.PrivacyPublic,
		},
		participation: &domain.Participation{
			ID:      participationID,
			EventID: eventID,
			UserID:  userID,
			Status:  domain.ParticipationStatusApproved,
		},
		existingUsers: 1,
	}
	tickets := &fakeTicketLifecycle{}
	service := NewService(repo, WithMutationDependencies(nil, tickets, &fakeUnitOfWork{}))

	// when
	result, err := service.CreateManualParticipation(context.Background(), CreateManualParticipationInput{
		AdminUserID: uuid.New(),
		EventID:     eventID,
		UserID:      userID,
		Status:      domain.ParticipationStatusApproved,
	})

	// then
	if err != nil {
		t.Fatalf("CreateManualParticipation() error = %v", err)
	}
	if tickets.createCallCount != 1 {
		t.Fatalf("expected ticket creation once, got %d", tickets.createCallCount)
	}
	if tickets.lastParticipation == nil || tickets.lastParticipation.ID != participationID {
		t.Fatalf("expected ticket participation %s, got %+v", participationID, tickets.lastParticipation)
	}
	if tickets.lastStatus != domain.TicketStatusActive {
		t.Fatalf("expected ACTIVE ticket status, got %q", tickets.lastStatus)
	}
	if result.TicketStatus == nil || *result.TicketStatus != domain.TicketStatusActive {
		t.Fatalf("expected ACTIVE ticket status in result, got %+v", result.TicketStatus)
	}
}
