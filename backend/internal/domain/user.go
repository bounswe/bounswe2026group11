package domain

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

// UserStatus is the lifecycle state of an application account.
type UserStatus string

// UserRole is the authorization role attached to an application account.
type UserRole string

const (
	// UserStatusActive is the default status assigned to newly registered users.
	UserStatusActive = "active"

	// UserRoleUser is the default non-admin role for regular accounts.
	UserRoleUser UserRole = "USER"
	// UserRoleAdmin allows access to web-only admin backoffice endpoints.
	UserRoleAdmin UserRole = "ADMIN"
)

var userRoles = map[string]UserRole{
	string(UserRoleUser):  UserRoleUser,
	string(UserRoleAdmin): UserRoleAdmin,
}

var userStatuses = map[string]UserStatus{
	UserStatusActive: UserStatus(UserStatusActive),
}

// ParseUserRole converts a wire string into a UserRole.
func ParseUserRole(value string) (UserRole, bool) {
	role, ok := userRoles[strings.ToUpper(strings.TrimSpace(value))]
	return role, ok
}

// ParseUserStatus converts a wire string into a UserStatus.
func ParseUserStatus(value string) (UserStatus, bool) {
	status, ok := userStatuses[strings.TrimSpace(value)]
	return status, ok
}

// String returns the serialized wire value of the role.
func (r UserRole) String() string {
	return string(r)
}

// String returns the serialized persistence value of the status.
func (s UserStatus) String() string {
	return string(s)
}

// User is the core identity entity representing a registered account.
type User struct {
	ID              uuid.UUID
	Username        string
	Email           string
	PhoneNumber     *string
	Gender          *string
	BirthDate       *time.Time
	PasswordHash    string
	EmailVerifiedAt *time.Time
	LastLogin       *time.Time
	Status          UserStatus
	Role            UserRole
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// UserSummary is a safe-to-serialize projection of User that omits sensitive
// fields like PasswordHash. It is returned in authentication responses.
type UserSummary struct {
	ID            uuid.UUID `json:"id"`
	Username      string    `json:"username"`
	Email         string    `json:"email"`
	PhoneNumber   *string   `json:"phone_number"`
	EmailVerified bool      `json:"email_verified"`
	Status        string    `json:"status"`
	Role          string    `json:"role"`
	Gender        *string   `json:"gender"`
	BirthDate     *string   `json:"birth_date"`
}

// Summary converts a full User into a UserSummary, deriving EmailVerified from
// whether EmailVerifiedAt is set.
func (u User) Summary() UserSummary {
	s := UserSummary{
		ID:            u.ID,
		Username:      u.Username,
		Email:         u.Email,
		PhoneNumber:   u.PhoneNumber,
		EmailVerified: u.EmailVerifiedAt != nil,
		Status:        string(u.Status),
		Role:          string(u.Role),
		Gender:        u.Gender,
	}
	if u.BirthDate != nil {
		formatted := u.BirthDate.Format("2006-01-02")
		s.BirthDate = &formatted
	}
	return s
}
