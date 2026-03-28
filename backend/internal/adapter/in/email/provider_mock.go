package email

import (
	"context"
	"fmt"
	"log"
	"strings"

	emailapp "github.com/bounswe/bounswe2026group11/backend/internal/application/email"
)

// MockProvider logs transactional emails instead of delivering them.
type MockProvider struct{}

var _ emailapp.Provider = MockProvider{}

func (MockProvider) Send(_ context.Context, message emailapp.Message) error {
	to := strings.TrimSpace(message.To)
	if to == "" {
		return fmt.Errorf("mock email provider: recipient is required")
	}

	log.Printf(
		"mock email provider: from_local_part=%s to=%s subject=%q text=%q",
		strings.TrimSpace(message.FromLocalPart),
		to,
		strings.TrimSpace(message.Subject),
		strings.TrimSpace(message.Text),
	)
	return nil
}
