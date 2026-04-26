//go:build integration

package tests_integration

import (
	"context"
	"testing"
	"time"

	eventapp "github.com/bounswe/bounswe2026group11/backend/internal/application/event"
	ticketapp "github.com/bounswe/bounswe2026group11/backend/internal/application/ticket"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/bounswe/bounswe2026group11/backend/tests_integration/common"
	"github.com/google/uuid"
)

func TestProtectedJoinApprovalCreatesActiveTicket(t *testing.T) {
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	participant := common.GivenUser(t, harness.AuthRepo)
	eventRef := common.GivenProtectedEvent(t, harness.Service, host.ID)

	joinRequest, err := harness.Service.RequestJoin(context.Background(), participant.ID, eventRef.ID, eventapp.RequestJoinInput{})
	if err != nil {
		t.Fatalf("RequestJoin() error = %v", err)
	}
	joinRequestID := uuid.MustParse(joinRequest.JoinRequestID)

	if _, err := harness.Service.ApproveJoinRequest(context.Background(), host.ID, eventRef.ID, joinRequestID); err != nil {
		t.Fatalf("ApproveJoinRequest() error = %v", err)
	}

	tickets, err := harness.TicketService.ListMyTickets(context.Background(), participant.ID)
	if err != nil {
		t.Fatalf("ListMyTickets() error = %v", err)
	}
	if len(tickets.Items) != 1 {
		t.Fatalf("expected 1 ticket, got %d", len(tickets.Items))
	}
	if tickets.Items[0].Status != domain.TicketStatusActive {
		t.Fatalf("expected ACTIVE ticket, got %q", tickets.Items[0].Status)
	}
	if tickets.Items[0].Event.ID != eventRef.ID.String() {
		t.Fatalf("expected ticket for event %s, got %s", eventRef.ID, tickets.Items[0].Event.ID)
	}
}

func TestPublicJoinCreatesNoTicket(t *testing.T) {
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	participant := common.GivenUser(t, harness.AuthRepo)
	eventRef := common.GivenPublicEvent(t, harness.Service, host.ID)

	if _, err := harness.Service.JoinEvent(context.Background(), participant.ID, eventRef.ID); err != nil {
		t.Fatalf("JoinEvent() error = %v", err)
	}

	tickets, err := harness.TicketService.ListMyTickets(context.Background(), participant.ID)
	if err != nil {
		t.Fatalf("ListMyTickets() error = %v", err)
	}
	if len(tickets.Items) != 0 {
		t.Fatalf("expected no tickets for public join, got %d", len(tickets.Items))
	}
}

func TestTicketQRScanAcceptsOnceThenRejectsReuse(t *testing.T) {
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	participant := common.GivenUser(t, harness.AuthRepo)
	eventRef := common.GivenProtectedEvent(t, harness.Service, host.ID)
	ticketID := approveProtectedParticipantAndReturnTicketID(t, harness, host.ID, participant.ID, eventRef.ID)

	qr, err := harness.TicketService.IssueQRToken(context.Background(), participant.ID, ticketID, ticketapp.QRTokenInput{Lat: 41.0, Lon: 29.0})
	if err != nil {
		t.Fatalf("IssueQRToken() error = %v", err)
	}

	accepted, err := harness.TicketService.ScanTicket(context.Background(), host.ID, eventRef.ID, ticketapp.ScanTicketInput{QRToken: qr.Token})
	if err != nil {
		t.Fatalf("ScanTicket() error = %v", err)
	}
	if accepted.Result != ticketapp.ScanResultAccepted {
		t.Fatalf("expected ACCEPTED scan, got %+v", accepted)
	}

	rejected, err := harness.TicketService.ScanTicket(context.Background(), host.ID, eventRef.ID, ticketapp.ScanTicketInput{QRToken: qr.Token})
	if err != nil {
		t.Fatalf("ScanTicket() reuse error = %v", err)
	}
	if rejected.Result != ticketapp.ScanResultRejected || rejected.Reason == nil || *rejected.Reason != ticketapp.RejectReasonTicketAlreadyUsed {
		t.Fatalf("expected already-used rejection, got %+v", rejected)
	}
}

func TestTicketDetailOwnershipAndProximity(t *testing.T) {
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	participant := common.GivenUser(t, harness.AuthRepo)
	other := common.GivenUser(t, harness.AuthRepo)
	eventRef := common.GivenProtectedEvent(t, harness.Service, host.ID)
	ticketID := approveProtectedParticipantAndReturnTicketID(t, harness, host.ID, participant.ID, eventRef.ID)

	detail, err := harness.TicketService.GetMyTicket(context.Background(), participant.ID, ticketID)
	if err != nil {
		t.Fatalf("GetMyTicket() error = %v", err)
	}
	if !detail.QRAccess.EligibleNow {
		t.Fatalf("expected active approved ticket to be QR-eligible, got %+v", detail.QRAccess)
	}

	_, err = harness.TicketService.GetMyTicket(context.Background(), other.ID, ticketID)
	common.RequireAppErrorCode(t, err, domain.ErrorCodeTicketNotFound)

	_, err = harness.TicketService.IssueQRToken(context.Background(), participant.ID, ticketID, ticketapp.QRTokenInput{Lat: 40.0, Lon: 28.0})
	common.RequireAppErrorCode(t, err, domain.ErrorCodeTicketProximityRequired)
}

func TestEventCancelCancelsTickets(t *testing.T) {
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	participant := common.GivenUser(t, harness.AuthRepo)
	eventRef := common.GivenProtectedEvent(t, harness.Service, host.ID)
	ticketID := approveProtectedParticipantAndReturnTicketID(t, harness, host.ID, participant.ID, eventRef.ID)

	if err := harness.Service.CancelEvent(context.Background(), host.ID, eventRef.ID); err != nil {
		t.Fatalf("CancelEvent() error = %v", err)
	}

	detail, err := harness.TicketService.GetMyTicket(context.Background(), participant.ID, ticketID)
	if err != nil {
		t.Fatalf("GetMyTicket() error = %v", err)
	}
	if detail.Ticket.Status != domain.TicketStatusCanceled {
		t.Fatalf("expected CANCELED ticket, got %q", detail.Ticket.Status)
	}
}

func TestEventStatusTransitionExpiresUnusedTickets(t *testing.T) {
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	participant := common.GivenUser(t, harness.AuthRepo)
	eventRef := common.GivenProtectedEvent(t, harness.Service, host.ID)
	ticketID := approveProtectedParticipantAndReturnTicketID(t, harness, host.ID, participant.ID, eventRef.ID)

	_, err := common.RequirePool(t).Exec(context.Background(), `
		UPDATE event
		SET start_time = $2,
		    updated_at = $3
		WHERE id = $1
	`, eventRef.ID, time.Now().UTC().Add(-61*24*time.Hour), time.Now().UTC().Add(-61*24*time.Hour))
	if err != nil {
		t.Fatalf("update event into expiry window error = %v", err)
	}

	if err := harness.EventRepo.TransitionEventStatuses(context.Background()); err != nil {
		t.Fatalf("TransitionEventStatuses() error = %v", err)
	}

	detail, err := harness.TicketService.GetMyTicket(context.Background(), participant.ID, ticketID)
	if err != nil {
		t.Fatalf("GetMyTicket() error = %v", err)
	}
	if detail.Ticket.Status != domain.TicketStatusExpired {
		t.Fatalf("expected EXPIRED ticket, got %q", detail.Ticket.Status)
	}
}

func approveProtectedParticipantAndReturnTicketID(t *testing.T, harness *common.EventHarness, hostID, participantID, eventID uuid.UUID) uuid.UUID {
	t.Helper()

	joinRequest, err := harness.Service.RequestJoin(context.Background(), participantID, eventID, eventapp.RequestJoinInput{})
	if err != nil {
		t.Fatalf("RequestJoin() error = %v", err)
	}
	if _, err := harness.Service.ApproveJoinRequest(context.Background(), hostID, eventID, uuid.MustParse(joinRequest.JoinRequestID)); err != nil {
		t.Fatalf("ApproveJoinRequest() error = %v", err)
	}
	tickets, err := harness.TicketService.ListMyTickets(context.Background(), participantID)
	if err != nil {
		t.Fatalf("ListMyTickets() error = %v", err)
	}
	if len(tickets.Items) != 1 {
		t.Fatalf("expected one ticket, got %d", len(tickets.Items))
	}
	return uuid.MustParse(tickets.Items[0].TicketID)
}
