package email

import (
	"context"
	"strings"
	"testing"
	"time"

	authapp "github.com/bounswe/bounswe2026group11/backend/internal/application/auth"
	emailapp "github.com/bounswe/bounswe2026group11/backend/internal/application/email"
)

func TestAuthOTPMailerSendRegistrationOTPBuildsLightweightTemplate(t *testing.T) {
	// given
	provider := &capturingProvider{}
	mailer := NewAuthOTPMailer(provider)

	// when
	err := mailer.SendRegistrationOTP(context.Background(), authapp.OTPMailInput{
		Email:     "user@example.com",
		Code:      "123456",
		ExpiresIn: 10 * time.Minute,
	})

	// then
	if err != nil {
		t.Fatalf("SendRegistrationOTP() error = %v", err)
	}
	if provider.sendCount != 1 {
		t.Fatalf("expected one email send, got %d", provider.sendCount)
	}
	if provider.lastMessage.FromLocalPart != "auth" {
		t.Fatalf("expected auth sender local part, got %q", provider.lastMessage.FromLocalPart)
	}
	if provider.lastMessage.To != "user@example.com" {
		t.Fatalf("expected recipient to be preserved, got %q", provider.lastMessage.To)
	}
	if provider.lastMessage.Subject != "Your Social Event Mapper verification code" {
		t.Fatalf("unexpected subject %q", provider.lastMessage.Subject)
	}
	assertOTPTemplateOutput(t, provider.lastMessage, "Verify your email", "123456", "10 minutes")
}

func TestAuthOTPMailerSendPasswordResetOTPBuildsPurposeSpecificCopy(t *testing.T) {
	// given
	provider := &capturingProvider{}
	mailer := NewAuthOTPMailer(provider)

	// when
	err := mailer.SendPasswordResetOTP(context.Background(), authapp.OTPMailInput{
		Email:     "user@example.com",
		Code:      "654321",
		ExpiresIn: 10 * time.Minute,
	})

	// then
	if err != nil {
		t.Fatalf("SendPasswordResetOTP() error = %v", err)
	}
	if provider.lastMessage.Subject != "Your Social Event Mapper password reset code" {
		t.Fatalf("unexpected subject %q", provider.lastMessage.Subject)
	}
	assertOTPTemplateOutput(t, provider.lastMessage, "Reset your password", "654321", "10 minutes")
}

func assertOTPTemplateOutput(t *testing.T, message emailapp.Message, heading, code, expiry string) {
	t.Helper()

	if len(message.HTML) == 0 || len(message.Text) == 0 {
		t.Fatal("expected both html and text bodies to be rendered")
	}
	if len(message.HTML) > 12_000 {
		t.Fatalf("expected lightweight html body, got %d bytes", len(message.HTML))
	}
	for _, expected := range []string{heading, code, expiry} {
		if !strings.Contains(message.HTML, expected) {
			t.Fatalf("expected html body to contain %q", expected)
		}
		if !strings.Contains(message.Text, expected) {
			t.Fatalf("expected text body to contain %q", expected)
		}
	}
	if strings.Contains(message.HTML, "https://") || strings.Contains(message.HTML, "http://") {
		t.Fatalf("expected otp html to avoid remote links, got %q", message.HTML)
	}
}

type capturingProvider struct {
	lastMessage emailapp.Message
	sendCount   int
}

func (p *capturingProvider) Send(_ context.Context, message emailapp.Message) error {
	p.sendCount++
	p.lastMessage = message
	return nil
}
