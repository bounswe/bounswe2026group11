package domain

import "time"

// CheckParticipationEligibility returns a non-nil *AppError when the user does
// not satisfy the event's participation restrictions. It is called by both
// the direct-join and join-request flows so that every caller enforces the
// same rules regardless of delivery layer.
//
// Errors:
//   - 400 profile_incomplete        – restriction exists but user has not set the relevant field
//   - 409 age_requirement_not_met   – user is below the event's minimum age
//   - 409 gender_requirement_not_met – user gender does not match the preferred gender
func CheckParticipationEligibility(user *User, event *Event, now time.Time) *AppError {
	if event.MinimumAge != nil {
		if user.BirthDate == nil {
			return BadRequestError(
				ErrorCodeProfileIncomplete,
				"Your birth date must be set on your profile to join age-restricted events.",
			)
		}
		if !HasMinimumAge(*user.BirthDate, *event.MinimumAge, now) {
			return ConflictError(
				ErrorCodeAgeRequirementNotMet,
				"You do not meet the minimum age required by this event.",
			)
		}
	}

	if event.PreferredGender != nil {
		if user.Gender == nil {
			return BadRequestError(
				ErrorCodeProfileIncomplete,
				"Your gender must be set on your profile to join this event.",
			)
		}
		if *user.Gender != string(*event.PreferredGender) {
			return ConflictError(
				ErrorCodeGenderRequirementNotMet,
				"This event is restricted to participants of a specific gender.",
			)
		}
	}

	return nil
}

// HasMinimumAge reports whether a person born on birthDate has reached at
// least minAge years by now. It accounts for whether the user's birthday has
// passed this year. Comparison is done by month/day (rather than day-of-year)
// so the result is correct across leap years.
func HasMinimumAge(birthDate time.Time, minAge int, now time.Time) bool {
	age := now.Year() - birthDate.Year()
	nowMonth, nowDay := now.Month(), now.Day()
	bMonth, bDay := birthDate.Month(), birthDate.Day()
	if nowMonth < bMonth || (nowMonth == bMonth && nowDay < bDay) {
		age--
	}
	return age >= minAge
}
