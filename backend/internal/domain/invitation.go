package domain

// InvitationStatus defines the lifecycle state of an invitation row.
type InvitationStatus string

const (
	InvitationStatusPending  InvitationStatus = "PENDING"
	InvitationStatusAccepted InvitationStatus = "ACCEPTED"
	InvitationStatusDeclined InvitationStatus = "DECLINED"
	InvitationStatusExpired  InvitationStatus = "EXPIRED"
)
