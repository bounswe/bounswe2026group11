package email

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	emailapp "github.com/bounswe/bounswe2026group11/backend/internal/application/email"
	"github.com/resend/resend-go/v3"
)

const senderDisplayName = "Social Event Mapper"

// ResendProvider delivers transactional emails through the Resend API.
type ResendProvider struct {
	client *resend.Client
	domain string
}

var _ emailapp.Provider = (*ResendProvider)(nil)

// NewResendProvider creates a Resend-backed transactional email provider.
func NewResendProvider(apiKey, domain string) *ResendProvider {
	return newResendProvider(resend.NewClient(apiKey), domain)
}

func newResendProviderWithHTTPClient(apiKey, domain string, httpClient *http.Client) *ResendProvider {
	return newResendProvider(resend.NewCustomClient(httpClient, apiKey), domain)
}

func newResendProvider(client *resend.Client, domain string) *ResendProvider {
	return &ResendProvider{
		client: client,
		domain: strings.TrimSpace(domain),
	}
}

func (p *ResendProvider) Send(ctx context.Context, message emailapp.Message) error {
	if p == nil || p.client == nil {
		return fmt.Errorf("resend email provider is not configured")
	}

	fromLocalPart := strings.TrimSpace(message.FromLocalPart)
	if fromLocalPart == "" {
		return fmt.Errorf("resend email provider: from local part is required")
	}
	if strings.Contains(fromLocalPart, "@") {
		return fmt.Errorf("resend email provider: from local part must not contain @")
	}

	to := strings.TrimSpace(message.To)
	if to == "" {
		return fmt.Errorf("resend email provider: recipient is required")
	}

	subject := strings.TrimSpace(message.Subject)
	if subject == "" {
		return fmt.Errorf("resend email provider: subject is required")
	}

	params := &resend.SendEmailRequest{
		From:    fmt.Sprintf("%s <%s@%s>", senderDisplayName, fromLocalPart, p.domain),
		To:      []string{to},
		Subject: subject,
		Html:    message.HTML,
		Text:    message.Text,
	}

	if _, err := p.client.Emails.SendWithContext(ctx, params); err != nil {
		return fmt.Errorf("send email with resend: %w", err)
	}

	return nil
}
