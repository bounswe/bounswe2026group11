package invitation

import (
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

const (
	FailureAlreadyInvited       = "ALREADY_INVITED"
	FailureAlreadyParticipating = "ALREADY_PARTICIPATING"
	FailureHostUser             = "HOST_USER"
	FailureDeclineCooldown      = "DECLINE_COOLDOWN_ACTIVE"
	FailureCapacityExceeded     = "CAPACITY_EXCEEDED"
	FailureDuplicateUsername    = "DUPLICATE_USERNAME"
)

type CreateInvitationsParams struct {
	EventID   uuid.UUID
	HostID    uuid.UUID
	Usernames []string
	Message   *string
	Now       time.Time
}

type InvitationFailureRecord struct {
	Username string
	Code     string
}

type CreatedInvitationRecord struct {
	Invitation *domain.Invitation
	Username   string
}

type CreateInvitationsRecord struct {
	SuccessfulInvitations []CreatedInvitationRecord
	InvalidUsernames      []string
	Failed                []InvitationFailureRecord
}

type ReceivedInvitationRecord struct {
	InvitationID uuid.UUID
	Status       domain.InvitationStatus
	Message      *string
	ExpiresAt    *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
	Event        ReceivedInvitationEventRecord
	Host         ReceivedInvitationUserRecord
}

type ReceivedInvitationEventRecord struct {
	ID                       uuid.UUID
	Title                    string
	ImageURL                 *string
	StartTime                time.Time
	EndTime                  *time.Time
	Status                   domain.EventStatus
	PrivacyLevel             domain.EventPrivacyLevel
	ApprovedParticipantCount int
}

type ReceivedInvitationUserRecord struct {
	ID          uuid.UUID
	Username    string
	DisplayName *string
	AvatarURL   *string
}

type AcceptInvitationRecord struct {
	Invitation    *domain.Invitation
	Participation *domain.Participation
}
