package admin

import "context"

// Repository is the persistence port for read-only backoffice list queries.
type Repository interface {
	ListUsers(ctx context.Context, input ListUsersInput) (*ListUsersResult, error)
	ListEvents(ctx context.Context, input ListEventsInput) (*ListEventsResult, error)
	ListParticipations(ctx context.Context, input ListParticipationsInput) (*ListParticipationsResult, error)
	ListTickets(ctx context.Context, input ListTicketsInput) (*ListTicketsResult, error)
}
