package email

import (
	"context"
	"fmt"
	"strings"
	"time"

	authapp "github.com/bounswe/bounswe2026group11/backend/internal/application/auth"
	emailapp "github.com/bounswe/bounswe2026group11/backend/internal/application/email"
)

const authSenderLocalPart = "auth"

// AuthOTPMailer sends auth OTP emails through the shared transactional provider.
type AuthOTPMailer struct {
	provider emailapp.Provider
	renderer otpTemplateRenderer
}

var _ authapp.OTPMailer = (*AuthOTPMailer)(nil)

// NewAuthOTPMailer constructs the auth OTP mail adapter.
func NewAuthOTPMailer(provider emailapp.Provider) *AuthOTPMailer {
	return &AuthOTPMailer{
		provider: provider,
		renderer: newOTPTemplateRenderer(),
	}
}

func (m *AuthOTPMailer) SendRegistrationOTP(ctx context.Context, input authapp.OTPMailInput) error {
	return m.send(ctx, input, otpMailContent{
		Subject:     "Your Social Event Mapper verification code",
		PreviewText: "Use this code to finish creating your account.",
		Heading:     "Verify your email",
		Intro:       "Use this code to finish creating your Social Event Mapper account.",
	})
}

func (m *AuthOTPMailer) SendPasswordResetOTP(ctx context.Context, input authapp.OTPMailInput) error {
	return m.send(ctx, input, otpMailContent{
		Subject:     "Your Social Event Mapper password reset code",
		PreviewText: "Use this code to reset your password.",
		Heading:     "Reset your password",
		Intro:       "Use this code to continue resetting your Social Event Mapper password.",
	})
}

type otpMailContent struct {
	Subject     string
	PreviewText string
	Heading     string
	Intro       string
}

func (m *AuthOTPMailer) send(ctx context.Context, input authapp.OTPMailInput, content otpMailContent) error {
	if m == nil || m.provider == nil {
		return fmt.Errorf("auth otp mailer is not configured")
	}

	htmlBody, textBody, err := m.renderer.Render(otpTemplateData{
		PreviewText: content.PreviewText,
		Heading:     content.Heading,
		Intro:       content.Intro,
		Code:        strings.TrimSpace(input.Code),
		ExpiryText:  fmt.Sprintf("This code expires in %s.", formatDurationForEmail(input.ExpiresIn)),
		IgnoreText:  "If you did not request this code, you can safely ignore this email.",
	})
	if err != nil {
		return fmt.Errorf("render auth otp email: %w", err)
	}

	if err := m.provider.Send(ctx, emailapp.Message{
		FromLocalPart: authSenderLocalPart,
		To:            strings.TrimSpace(input.Email),
		Subject:       content.Subject,
		HTML:          htmlBody,
		Text:          textBody,
	}); err != nil {
		return fmt.Errorf("deliver auth otp email: %w", err)
	}

	return nil
}

func formatDurationForEmail(value time.Duration) string {
	switch {
	case value%time.Hour == 0 && value >= time.Hour:
		hours := int(value / time.Hour)
		if hours == 1 {
			return "1 hour"
		}
		return fmt.Sprintf("%d hours", hours)
	case value%time.Minute == 0 && value >= time.Minute:
		minutes := int(value / time.Minute)
		if minutes == 1 {
			return "1 minute"
		}
		return fmt.Sprintf("%d minutes", minutes)
	default:
		seconds := int(value / time.Second)
		if seconds == 1 {
			return "1 second"
		}
		return fmt.Sprintf("%d seconds", seconds)
	}
}
