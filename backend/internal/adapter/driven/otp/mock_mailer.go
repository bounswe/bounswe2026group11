package otp

import (
	"context"
	"log"
)

// MockMailer implements domain.OTPMailer by logging to stdout.
type MockMailer struct{}

// SendRegistrationOTP logs the OTP to stdout instead of sending a real email.
func (MockMailer) SendRegistrationOTP(_ context.Context, email, code string) error {
	log.Printf("mock mailer: registration OTP for %s is %s", email, code)
	return nil
}
