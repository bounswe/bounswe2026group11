package invitation

import "time"

type CreateInvitationsInput struct {
	Usernames []string
	Message   *string
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

type ReceivedInvitationsResult struct {
	Items []ReceivedInvitation `json:"items"`
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
