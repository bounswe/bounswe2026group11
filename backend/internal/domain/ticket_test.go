package domain

import "testing"

func TestParseTicketStatusAcceptsKnownStatuses(t *testing.T) {
	for _, status := range []TicketStatus{
		TicketStatusActive,
		TicketStatusPending,
		TicketStatusExpired,
		TicketStatusUsed,
		TicketStatusCanceled,
	} {
		parsed, ok := ParseTicketStatus(status.String())
		if !ok {
			t.Fatalf("expected status %q to parse", status)
		}
		if parsed != status {
			t.Fatalf("expected %q, got %q", status, parsed)
		}
	}
}

func TestParseTicketStatusRejectsUnknownStatus(t *testing.T) {
	if _, ok := ParseTicketStatus("active"); ok {
		t.Fatal("expected lowercase status to be rejected")
	}
}
