package domain_test

import (
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

func ptrString(s string) *string                                               { return &s }
func ptrInt(i int) *int                                                        { return &i }
func ptrTime(t time.Time) *time.Time                                           { return &t }
func ptrGender(g domain.EventParticipantGender) *domain.EventParticipantGender { return &g }

// referenceNow is a fixed "now" used to keep age arithmetic deterministic.
var referenceNow = time.Date(2026, 4, 18, 12, 0, 0, 0, time.UTC)

func TestCheckParticipationEligibilityAllowsWhenNoRestrictions(t *testing.T) {
	user := &domain.User{BirthDate: ptrTime(time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC))}
	event := &domain.Event{}

	if err := domain.CheckParticipationEligibility(user, event, referenceNow); err != nil {
		t.Fatalf("expected eligibility, got %v", err)
	}
}

func TestCheckParticipationEligibilityRejectsUnderageUser(t *testing.T) {
	user := &domain.User{BirthDate: ptrTime(time.Date(2015, 1, 1, 0, 0, 0, 0, time.UTC))} // 11 yrs old at reference
	event := &domain.Event{MinimumAge: ptrInt(18)}

	err := domain.CheckParticipationEligibility(user, event, referenceNow)
	if err == nil || err.Code != domain.ErrorCodeAgeRequirementNotMet {
		t.Fatalf("expected age_requirement_not_met, got %v", err)
	}
	if err.Status != domain.StatusConflict {
		t.Fatalf("expected 409 status, got %d", err.Status)
	}
}

func TestCheckParticipationEligibilityRequiresBirthDateWhenAgeRestricted(t *testing.T) {
	user := &domain.User{BirthDate: nil}
	event := &domain.Event{MinimumAge: ptrInt(18)}

	err := domain.CheckParticipationEligibility(user, event, referenceNow)
	if err == nil || err.Code != domain.ErrorCodeProfileIncomplete {
		t.Fatalf("expected profile_incomplete, got %v", err)
	}
	if err.Status != domain.StatusBadRequest {
		t.Fatalf("expected 400 status, got %d", err.Status)
	}
}

func TestCheckParticipationEligibilityAllowsAtExactMinimumAge(t *testing.T) {
	// Born exactly 18 years before reference → eligible.
	user := &domain.User{BirthDate: ptrTime(time.Date(2008, 4, 18, 0, 0, 0, 0, time.UTC))}
	event := &domain.Event{MinimumAge: ptrInt(18)}

	if err := domain.CheckParticipationEligibility(user, event, referenceNow); err != nil {
		t.Fatalf("expected eligibility, got %v", err)
	}
}

func TestCheckParticipationEligibilityRejectsMismatchedGender(t *testing.T) {
	user := &domain.User{Gender: ptrString(string(domain.GenderMale))}
	event := &domain.Event{PreferredGender: ptrGender(domain.GenderFemale)}

	err := domain.CheckParticipationEligibility(user, event, referenceNow)
	if err == nil || err.Code != domain.ErrorCodeGenderRequirementNotMet {
		t.Fatalf("expected gender_requirement_not_met, got %v", err)
	}
	if err.Status != domain.StatusConflict {
		t.Fatalf("expected 409 status, got %d", err.Status)
	}
}

func TestCheckParticipationEligibilityRequiresGenderWhenGenderRestricted(t *testing.T) {
	user := &domain.User{Gender: nil}
	event := &domain.Event{PreferredGender: ptrGender(domain.GenderFemale)}

	err := domain.CheckParticipationEligibility(user, event, referenceNow)
	if err == nil || err.Code != domain.ErrorCodeProfileIncomplete {
		t.Fatalf("expected profile_incomplete, got %v", err)
	}
}

func TestCheckParticipationEligibilityAllowsMatchingGender(t *testing.T) {
	user := &domain.User{Gender: ptrString(string(domain.GenderFemale))}
	event := &domain.Event{PreferredGender: ptrGender(domain.GenderFemale)}

	if err := domain.CheckParticipationEligibility(user, event, referenceNow); err != nil {
		t.Fatalf("expected eligibility, got %v", err)
	}
}
