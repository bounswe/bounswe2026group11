package email

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	emailapp "github.com/bounswe/bounswe2026group11/backend/internal/application/email"
)

// MockProvider logs transactional emails instead of delivering them.
type MockProvider struct{}

var _ emailapp.Provider = MockProvider{}

func (MockProvider) Send(ctx context.Context, message emailapp.Message) error {
	to := strings.TrimSpace(message.To)
	if to == "" {
		return fmt.Errorf("mock email provider: recipient is required")
	}

	slog.InfoContext(ctx, "mock email provider delivery",
		"from_local_part", strings.TrimSpace(message.FromLocalPart),
		"to", to,
		"subject", strings.TrimSpace(message.Subject),
		"text", strings.TrimSpace(message.Text),
	)
	return nil
}
