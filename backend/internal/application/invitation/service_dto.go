package invitation

import (
	"time"

	"github.com/google/uuid"
)

const (
	// DefaultPastInvitationLimit is the page size used when callers do not
	// specify past_limit. Matches the team default for paginated endpoints.
	DefaultPastInvitationLimit = 25
	// MaxPastInvitationLimit caps client-supplied past_limit to keep request
	// cost predictable; matches NotificationCenter's MaxNotificationLimit.
	MaxPastInvitationLimit = 50
)

type CreateInvitationsInput struct {
	Usernames []string
	Message   *string
}

// ListReceivedInvitationsInput drives GET /me/invitations. Only the past
// bucket is paginated; pending always returns the full active set.
type ListReceivedInvitationsInput struct {
	UserID     uuid.UUID
	PastCursor *string
	PastLimit  *int
}

// PastInvitationCursor is the keyset used to paginate the past bucket.
// (UpdatedAt, InvitationID) is a stable, unique tuple under the bucket's
// (updated_at DESC, id DESC) ordering.
type PastInvitationCursor struct {
	UpdatedAt    time.Time `json:"updated_at"`
	InvitationID uuid.UUID `json:"invitation_id"`
}

type CreatedInvitation struct {
	InvitationID  string    `json:"invitation_id"`
	EventID       string    `json:"event_id"`
	InvitedUserID string    `json:"invited_user_id"`
	Username      string    `json:"username"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
}

type InvitationFailure struct {
	Username string `json:"username"`
	Code     string `json:"code"`
}

type CreateInvitationsResult struct {
	SuccessCount          int                 `json:"success_count"`
	InvalidUsernameCount  int                 `json:"invalid_username_count"`
	FailedCount           int                 `json:"failed_count"`
	SuccessfulInvitations []CreatedInvitation `json:"successful_invitations"`
	InvalidUsernames      []string            `json:"invalid_usernames"`
	Failed                []InvitationFailure `json:"failed"`
}

// ReceivedInvitationsResult is the response from GET /me/invitations,
// split into a pending bucket (all currently actionable invitations) and a
// past bucket (ACCEPTED + DECLINED + EXPIRED history, excluding CANCELED
// host-side revocations).
type ReceivedInvitationsResult struct {
	Pending []ReceivedInvitation          `json:"pending"`
	Past    ReceivedInvitationsPastResult `json:"past"`
}

// ReceivedInvitationsPastResult holds the paginated past bucket plus its
// cursor metadata. Only this bucket is paginated.
type ReceivedInvitationsPastResult struct {
	Items    []ReceivedInvitation `json:"items"`
	PageInfo InvitationPageInfo   `json:"page_info"`
}

// InvitationPageInfo mirrors the project's existing PageInfo shape (e.g.
// NotificationPageInfo) so clients can reuse pagination components.
type InvitationPageInfo struct {
	NextCursor *string `json:"next_cursor"`
	HasNext    bool    `json:"has_next"`
}

type ReceivedInvitation struct {
	InvitationID string                  `json:"invitation_id"`
	Status       string                  `json:"status"`
	Message      *string                 `json:"message"`
	ExpiresAt    *time.Time              `json:"expires_at"`
	CreatedAt    time.Time               `json:"created_at"`
	UpdatedAt    time.Time               `json:"updated_at"`
	Event        ReceivedInvitationEvent `json:"event"`
	Host         ReceivedInvitationUser  `json:"host"`
}

type ReceivedInvitationEvent struct {
	ID                       string     `json:"id"`
	Title                    string     `json:"title"`
	ImageURL                 *string    `json:"image_url"`
	StartTime                time.Time  `json:"start_time"`
	EndTime                  *time.Time `json:"end_time"`
	Status                   string     `json:"status"`
	PrivacyLevel             string     `json:"privacy_level"`
	ApprovedParticipantCount int        `json:"approved_participant_count"`
}

type ReceivedInvitationUser struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName *string `json:"display_name"`
	AvatarURL   *string `json:"avatar_url"`
}

type AcceptInvitationResult struct {
	InvitationID        string    `json:"invitation_id"`
	EventID             string    `json:"event_id"`
	InvitationStatus    string    `json:"invitation_status"`
	ParticipationID     string    `json:"participation_id"`
	ParticipationStatus string    `json:"participation_status"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type DeclineInvitationResult struct {
	InvitationID   string    `json:"invitation_id"`
	EventID        string    `json:"event_id"`
	Status         string    `json:"status"`
	UpdatedAt      time.Time `json:"updated_at"`
	CooldownEndsAt time.Time `json:"cooldown_ends_at"`
}
