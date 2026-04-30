package admin

import "context"

// UseCase exposes read-only backoffice list operations.
type UseCase interface {
	ListUsers(ctx context.Context, input ListUsersInput) (*ListUsersResult, error)
	ListEvents(ctx context.Context, input ListEventsInput) (*ListEventsResult, error)
	ListParticipations(ctx context.Context, input ListParticipationsInput) (*ListParticipationsResult, error)
	ListTickets(ctx context.Context, input ListTicketsInput) (*ListTicketsResult, error)
}
