package profile

import (
	"regexp"
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

var phonePattern = regexp.MustCompile(`^\+?[0-9\s\-().]{1,31}$`)

func validateUpdateProfileInput(input UpdateProfileInput) (*UpdateProfileInput, *domain.AppError) {
	details := make(map[string]string)

	out := UpdateProfileInput{UserID: input.UserID}

	if input.PhoneNumber != nil {
		trimmed := strings.TrimSpace(*input.PhoneNumber)
		if trimmed == "" {
			out.PhoneNumber = nil
		} else if len(trimmed) > 32 {
			details["phone_number"] = "must be at most 32 characters"
		} else {
			out.PhoneNumber = &trimmed
		}
	}

	if input.Gender != nil {
		upper := strings.ToUpper(strings.TrimSpace(*input.Gender))
		if upper == "" {
			out.Gender = nil
		} else {
			switch upper {
			case "MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY":
				out.Gender = &upper
			default:
				details["gender"] = "must be one of: MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY"
			}
		}
	}

	if input.BirthDate != nil {
		trimmed := strings.TrimSpace(*input.BirthDate)
		if trimmed == "" {
			out.BirthDate = nil
		} else {
			if _, err := time.Parse("2006-01-02", trimmed); err != nil {
				details["birth_date"] = "must be in YYYY-MM-DD format"
			} else {
				out.BirthDate = &trimmed
			}
		}
	}

	if input.DefaultLocationAddress != nil {
		trimmed := strings.TrimSpace(*input.DefaultLocationAddress)
		if trimmed == "" {
			out.DefaultLocationAddress = nil
		} else if len(trimmed) > 512 {
			details["default_location_address"] = "must be at most 512 characters"
		} else {
			out.DefaultLocationAddress = &trimmed
		}
	}

	if input.DefaultLocationLat != nil {
		lat := *input.DefaultLocationLat
		if lat < -90 || lat > 90 {
			details["default_location_lat"] = "must be between -90 and 90"
		} else {
			out.DefaultLocationLat = &lat
		}
	}

	if input.DefaultLocationLon != nil {
		lon := *input.DefaultLocationLon
		if lon < -180 || lon > 180 {
			details["default_location_lon"] = "must be between -180 and 180"
		} else {
			out.DefaultLocationLon = &lon
		}
	}

	if (input.DefaultLocationLat != nil) != (input.DefaultLocationLon != nil) {
		details["default_location"] = "lat and lon must be provided together"
	}

	if input.DisplayName != nil {
		trimmed := strings.TrimSpace(*input.DisplayName)
		if trimmed == "" {
			out.DisplayName = nil
		} else if len(trimmed) > 64 {
			details["display_name"] = "must be at most 64 characters"
		} else {
			out.DisplayName = &trimmed
		}
	}

	if input.Bio != nil {
		trimmed := strings.TrimSpace(*input.Bio)
		if trimmed == "" {
			out.Bio = nil
		} else if len(trimmed) > 512 {
			details["bio"] = "must be at most 512 characters"
		} else {
			out.Bio = &trimmed
		}
	}

	if input.AvatarURL != nil {
		trimmed := strings.TrimSpace(*input.AvatarURL)
		if trimmed == "" {
			out.AvatarURL = nil
		} else if len(trimmed) > 512 {
			details["avatar_url"] = "must be at most 512 characters"
		} else {
			out.AvatarURL = &trimmed
		}
	}

	if len(details) > 0 {
		return nil, domain.ValidationError(details)
	}

	return &out, nil
}
