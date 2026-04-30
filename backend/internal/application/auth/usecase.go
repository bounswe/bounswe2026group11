package auth

import "context"

// UseCase is the inbound application port for authentication flows.
type UseCase interface {
	RequestRegistrationOTP(ctx context.Context, input RequestOTPInput) error
	RequestPasswordResetOTP(ctx context.Context, input RequestOTPInput) error
	VerifyPasswordResetOTP(ctx context.Context, input VerifyPasswordResetInput) (*PasswordResetGrant, error)
	ResetPassword(ctx context.Context, input ResetPasswordInput) error
	VerifyRegistrationOTP(ctx context.Context, input VerifyRegistrationInput) (*Session, error)
	CheckAvailability(ctx context.Context, input CheckAvailabilityInput) (*CheckAvailabilityResult, error)
	Login(ctx context.Context, input LoginInput) (*Session, error)
	Refresh(ctx context.Context, refreshToken string, deviceInfo *string) (*Session, error)
	Logout(ctx context.Context, input LogoutInput) error
}
