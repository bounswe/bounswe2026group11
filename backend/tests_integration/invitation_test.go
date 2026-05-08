//go:build integration

package tests_integration

import (
	"context"
	"testing"
	"time"

	eventapp "github.com/bounswe/bounswe2026group11/backend/internal/application/event"
	invitationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/invitation"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/bounswe/bounswe2026group11/backend/tests_integration/common"
	"github.com/google/uuid"
)

// TestListReceivedInvitationsBuckets exercises GET /me/invitations end-to-end
// against a real Postgres. It seeds invitations across every status and
// asserts the bucketing rules from issue #581:
//   - pending bucket: PENDING for ACTIVE/IN_PROGRESS PRIVATE events only
//   - past bucket: DECLINED + EXPIRED only
//   - ACCEPTED is absent (already shows in My Events)
//   - CANCELED is absent (host-side decision should not surface here)
func TestListReceivedInvitationsBuckets(t *testing.T) {
	// given
	h := common.NewEventHarness(t)
	host := common.GivenUser(t, h.AuthRepo)
	invitee := common.GivenUser(t, h.AuthRepo)
	ctx := context.Background()

	pendingEvent := givenPrivateEvent(t, h.Service, host.ID)
	declinedEvent := givenPrivateEvent(t, h.Service, host.ID)
	expiredEvent := givenPrivateEvent(t, h.Service, host.ID)
	acceptedEvent := givenPrivateEvent(t, h.Service, host.ID)
	canceledEvent := givenPrivateEvent(t, h.Service, host.ID)

	pendingID := givenInvitation(t, h.InvitationService, host.ID, pendingEvent, invitee.Username)
	declinedID := givenInvitation(t, h.InvitationService, host.ID, declinedEvent, invitee.Username)
	expiredID := givenInvitation(t, h.InvitationService, host.ID, expiredEvent, invitee.Username)
	acceptedID := givenInvitation(t, h.InvitationService, host.ID, acceptedEvent, invitee.Username)
	canceledID := givenInvitation(t, h.InvitationService, host.ID, canceledEvent, invitee.Username)

	if _, err := h.InvitationService.DeclineInvitation(ctx, invitee.ID, declinedID); err != nil {
		t.Fatalf("DeclineInvitation: %v", err)
	}
	if _, err := h.InvitationService.AcceptInvitation(ctx, invitee.ID, acceptedID); err != nil {
		t.Fatalf("AcceptInvitation: %v", err)
	}
	if err := h.InvitationService.RevokeInvitation(ctx, host.ID, canceledEvent, canceledID); err != nil {
		t.Fatalf("RevokeInvitation: %v", err)
	}
	// EXPIRED has no public-API path; flip status directly to mimic the
	// scheduled job that sweeps overdue invitations in production.
	expireInvitation(t, expiredID)

	// when
	result, err := h.InvitationService.ListReceivedInvitations(ctx, invitationapp.ListReceivedInvitationsInput{
		UserID: invitee.ID,
	})
	if err != nil {
		t.Fatalf("ListReceivedInvitations: %v", err)
	}

	// then — pending bucket
	if got, want := len(result.Pending), 1; got != want {
		t.Fatalf("pending count = %d, want %d", got, want)
	}
	if result.Pending[0].InvitationID != pendingID.String() {
		t.Fatalf("pending[0] = %s, want %s", result.Pending[0].InvitationID, pendingID)
	}
	if result.Pending[0].Status != string(domain.InvitationStatusPending) {
		t.Fatalf("pending[0].status = %s, want PENDING", result.Pending[0].Status)
	}

	// then — past bucket: DECLINED + EXPIRED only
	if got, want := len(result.Past.Items), 2; got != want {
		t.Fatalf("past count = %d, want %d (items=%+v)", got, want, result.Past.Items)
	}
	pastIDs := map[string]string{
		result.Past.Items[0].InvitationID: result.Past.Items[0].Status,
		result.Past.Items[1].InvitationID: result.Past.Items[1].Status,
	}
	if pastIDs[declinedID.String()] != string(domain.InvitationStatusDeclined) {
		t.Errorf("DECLINED invitation %s missing or wrong status: %v", declinedID, pastIDs)
	}
	if pastIDs[expiredID.String()] != string(domain.InvitationStatusExpired) {
		t.Errorf("EXPIRED invitation %s missing or wrong status: %v", expiredID, pastIDs)
	}
	if _, found := pastIDs[acceptedID.String()]; found {
		t.Errorf("ACCEPTED invitation should NOT be in past, but found: %s", acceptedID)
	}
	if _, found := pastIDs[canceledID.String()]; found {
		t.Errorf("CANCELED invitation should NOT be in past, but found: %s", canceledID)
	}
	if result.Past.PageInfo.HasNext {
		t.Errorf("past.has_next = true, want false (only 2 items)")
	}
	if result.Past.PageInfo.NextCursor != nil {
		t.Errorf("past.next_cursor = %v, want nil", *result.Past.PageInfo.NextCursor)
	}
}

// TestListReceivedInvitationsPastPagination verifies cursor paging works:
// limit=1 returns one item with has_next=true and a non-nil cursor; the
// cursor request returns the second item with has_next=false.
func TestListReceivedInvitationsPastPagination(t *testing.T) {
	// given
	h := common.NewEventHarness(t)
	host := common.GivenUser(t, h.AuthRepo)
	invitee := common.GivenUser(t, h.AuthRepo)
	ctx := context.Background()

	firstEvent := givenPrivateEvent(t, h.Service, host.ID)
	secondEvent := givenPrivateEvent(t, h.Service, host.ID)
	first := givenInvitation(t, h.InvitationService, host.ID, firstEvent, invitee.Username)
	second := givenInvitation(t, h.InvitationService, host.ID, secondEvent, invitee.Username)

	// Decline first, then second — so by updated_at DESC, second appears first.
	if _, err := h.InvitationService.DeclineInvitation(ctx, invitee.ID, first); err != nil {
		t.Fatalf("DeclineInvitation first: %v", err)
	}
	// Force a discernible time delta so updated_at ordering is deterministic.
	time.Sleep(10 * time.Millisecond)
	if _, err := h.InvitationService.DeclineInvitation(ctx, invitee.ID, second); err != nil {
		t.Fatalf("DeclineInvitation second: %v", err)
	}

	// when — first page
	limit := 1
	page1, err := h.InvitationService.ListReceivedInvitations(ctx, invitationapp.ListReceivedInvitationsInput{
		UserID:    invitee.ID,
		PastLimit: &limit,
	})
	if err != nil {
		t.Fatalf("ListReceivedInvitations page1: %v", err)
	}

	// then — first page returns the most recently declined invitation
	if got, want := len(page1.Past.Items), 1; got != want {
		t.Fatalf("page1 past count = %d, want %d", got, want)
	}
	if page1.Past.Items[0].InvitationID != second.String() {
		t.Fatalf("page1[0] = %s, want %s (most recent decline)", page1.Past.Items[0].InvitationID, second)
	}
	if !page1.Past.PageInfo.HasNext {
		t.Fatalf("page1 has_next = false, want true")
	}
	if page1.Past.PageInfo.NextCursor == nil {
		t.Fatalf("page1 next_cursor is nil, want non-nil")
	}

	// when — second page using the cursor
	page2, err := h.InvitationService.ListReceivedInvitations(ctx, invitationapp.ListReceivedInvitationsInput{
		UserID:     invitee.ID,
		PastLimit:  &limit,
		PastCursor: page1.Past.PageInfo.NextCursor,
	})
	if err != nil {
		t.Fatalf("ListReceivedInvitations page2: %v", err)
	}

	// then — second page returns the older invitation, no next page
	if got, want := len(page2.Past.Items), 1; got != want {
		t.Fatalf("page2 past count = %d, want %d", got, want)
	}
	if page2.Past.Items[0].InvitationID != first.String() {
		t.Fatalf("page2[0] = %s, want %s", page2.Past.Items[0].InvitationID, first)
	}
	if page2.Past.PageInfo.HasNext {
		t.Errorf("page2 has_next = true, want false")
	}
	if page2.Past.PageInfo.NextCursor != nil {
		t.Errorf("page2 next_cursor non-nil, want nil")
	}
}

// givenPrivateEvent inserts a PRIVATE event owned by hostID using the live
// service so all invariants (location, category, etc.) are consistent with
// production behavior. Returns the event ID.
func givenPrivateEvent(t *testing.T, svc eventapp.UseCase, hostID uuid.UUID) uuid.UUID {
	t.Helper()
	categoryID := common.GivenEventCategory(t)
	startTime := time.Now().UTC().Add(24 * time.Hour)
	result, err := svc.CreateEvent(context.Background(), hostID, eventapp.CreateEventInput{
		Title:        "private_invitation_event_" + uuid.NewString()[:8],
		Description:  common.StringPtr("Integration fixture"),
		CategoryID:   &categoryID,
		LocationType: domain.LocationPoint,
		Lat:          common.Float64Ptr(41.0),
		Lon:          common.Float64Ptr(29.0),
		StartTime:    startTime,
		PrivacyLevel: domain.PrivacyPrivate,
	})
	if err != nil {
		t.Fatalf("givenPrivateEvent CreateEvent: %v", err)
	}
	id, err := uuid.Parse(result.ID)
	if err != nil {
		t.Fatalf("givenPrivateEvent uuid.Parse: %v", err)
	}
	return id
}

// givenInvitation creates a single PENDING invitation from host to the
// given invitee for the given event and returns the new invitation ID.
func givenInvitation(t *testing.T, svc invitationapp.UseCase, hostID, eventID uuid.UUID, inviteeUsername string) uuid.UUID {
	t.Helper()
	result, err := svc.CreateInvitations(context.Background(), hostID, eventID, invitationapp.CreateInvitationsInput{
		Usernames: []string{inviteeUsername},
	})
	if err != nil {
		t.Fatalf("givenInvitation CreateInvitations: %v", err)
	}
	if len(result.SuccessfulInvitations) != 1 {
		t.Fatalf("givenInvitation expected 1 successful invitation, got %d (failures=%v)", len(result.SuccessfulInvitations), result.Failed)
	}
	id, err := uuid.Parse(result.SuccessfulInvitations[0].InvitationID)
	if err != nil {
		t.Fatalf("givenInvitation uuid.Parse: %v", err)
	}
	return id
}

// expireInvitation flips an invitation to EXPIRED via raw SQL so we can
// exercise the past-bucket EXPIRED path without standing up the scheduled
// expiry job. The production sweeper performs the equivalent UPDATE.
func expireInvitation(t *testing.T, invitationID uuid.UUID) {
	t.Helper()
	pool := common.RequirePool(t)
	tag, err := pool.Exec(context.Background(),
		`UPDATE invitation SET status = $1, updated_at = now() WHERE id = $2`,
		domain.InvitationStatusExpired, invitationID,
	)
	if err != nil {
		t.Fatalf("expireInvitation: %v", err)
	}
	if tag.RowsAffected() != 1 {
		t.Fatalf("expireInvitation: expected 1 row affected, got %d", tag.RowsAffected())
	}
}
