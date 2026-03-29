package email

import "context"

// Message represents a single transactional email send request.
type Message struct {
	FromLocalPart string
	To            string
	Subject       string
	HTML          string
	Text          string
}

// Provider sends a transactional email through an external delivery service.
type Provider interface {
	Send(ctx context.Context, message Message) error
}
