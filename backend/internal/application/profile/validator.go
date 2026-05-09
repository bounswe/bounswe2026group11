package profile

import (
	"strconv"
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/bounswe/bounswe2026group11/backend/internal/i18n"
)

func validateChangePasswordInput(input ChangePasswordInput) *domain.AppError {
	details := make(map[string]string)

	if len(input.OldPassword) == 0 {
		details["old_password"] = "must not be empty"
	}
	if len(input.NewPassword) < 8 || len(input.NewPassword) > 128 {
		details["new_password"] = "must be between 8 and 128 characters"
	}
	if input.OldPassword == input.NewPassword && len(details) == 0 {
		details["new_password"] = "must differ from current password"
	}

	if len(details) > 0 {
		return domain.ValidationError(details)
	}
	return nil
}

func validateUpdateProfileInput(input UpdateProfileInput) (*UpdateProfileInput, *domain.AppError) {
	detailKeys := make(map[string]string)

	out := UpdateProfileInput{UserID: input.UserID}

	if input.PhoneNumber != nil {
		trimmed := strings.TrimSpace(*input.PhoneNumber)
		if trimmed == "" {
			out.PhoneNumber = nil
		} else if len(trimmed) > 32 {
			detailKeys["phone_number"] = "validation.phone_number.too_long"
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
				detailKeys["gender"] = "validation.gender.invalid"
			}
		}
	}

	if input.BirthDate != nil {
		trimmed := strings.TrimSpace(*input.BirthDate)
		if trimmed == "" {
			out.BirthDate = nil
		} else {
			if _, err := time.Parse("2006-01-02", trimmed); err != nil {
				detailKeys["birth_date"] = "validation.birth_date.format"
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
			detailKeys["default_location_address"] = "validation.default_location_address.too_long"
		} else {
			out.DefaultLocationAddress = &trimmed
		}
	}

	if input.DefaultLocationLat != nil {
		lat := *input.DefaultLocationLat
		if lat < -90 || lat > 90 {
			detailKeys["default_location_lat"] = "validation.default_location_lat.range"
		} else {
			out.DefaultLocationLat = &lat
		}
	}

	if input.DefaultLocationLon != nil {
		lon := *input.DefaultLocationLon
		if lon < -180 || lon > 180 {
			detailKeys["default_location_lon"] = "validation.default_location_lon.range"
		} else {
			out.DefaultLocationLon = &lon
		}
	}

	if (input.DefaultLocationLat != nil) != (input.DefaultLocationLon != nil) {
		detailKeys["default_location"] = "validation.default_location.lat_lon_pair_required"
	}

	if input.DisplayName != nil {
		trimmed := strings.TrimSpace(*input.DisplayName)
		if trimmed == "" {
			out.DisplayName = nil
		} else if len(trimmed) > 64 {
			detailKeys["display_name"] = "validation.display_name.too_long"
		} else {
			out.DisplayName = &trimmed
		}
	}

	if input.Bio != nil {
		trimmed := strings.TrimSpace(*input.Bio)
		if trimmed == "" {
			out.Bio = nil
		} else if len(trimmed) > 512 {
			detailKeys["bio"] = "validation.bio.too_long"
		} else {
			out.Bio = &trimmed
		}
	}

	if input.AvatarURL != nil {
		trimmed := strings.TrimSpace(*input.AvatarURL)
		if trimmed == "" {
			out.AvatarURL = nil
		} else if len(trimmed) > 512 {
			detailKeys["avatar_url"] = "validation.avatar_url.too_long"
		} else {
			out.AvatarURL = &trimmed
		}
	}

	if input.Locale != nil {
		trimmed := strings.TrimSpace(*input.Locale)
		if trimmed == "" {
			out.Locale = nil
		} else if loc, ok := i18n.Parse(trimmed); ok {
			normalized := string(loc)
			out.Locale = &normalized
		} else {
			detailKeys["locale"] = "validation.locale.unsupported"
		}
	}

	if len(detailKeys) > 0 {
		return nil, domain.ValidationErrorI18n(detailKeys)
	}

	return &out, nil
}

func validateCreateEquipmentInput(input CreateEquipmentInput) (*CreateEquipmentInput, *domain.AppError) {
	details := make(map[string]string)

	name := strings.TrimSpace(input.Name)
	if name == "" {
		details["name"] = "must not be empty"
	} else if len(name) > 64 {
		details["name"] = "must be at most 64 characters"
	}

	description := normalizeOptionalEquipmentText(input.Description, 512, "description", details)
	imageURL := normalizeOptionalEquipmentText(input.ImageURL, 512, "image_url", details)

	if len(details) > 0 {
		return nil, domain.ValidationError(details)
	}

	return &CreateEquipmentInput{
		UserID:      input.UserID,
		Name:        name,
		Description: description,
		ImageURL:    imageURL,
	}, nil
}

func validateUpdateEquipmentInput(input UpdateEquipmentInput) (*UpdateEquipmentInput, *domain.AppError) {
	details := make(map[string]string)

	var (
		name        *string
		description *string
		imageURL    *string
	)

	if input.Name != nil {
		trimmed := strings.TrimSpace(*input.Name)
		if trimmed == "" {
			details["name"] = "must not be empty"
		} else if len(trimmed) > 64 {
			details["name"] = "must be at most 64 characters"
		} else {
			name = &trimmed
		}
	}

	description = normalizeOptionalEquipmentText(input.Description, 512, "description", details)
	imageURL = normalizeOptionalEquipmentText(input.ImageURL, 512, "image_url", details)

	if input.Name == nil && input.Description == nil && input.ImageURL == nil {
		details["body"] = "must include at least one updatable field"
	}

	if len(details) > 0 {
		return nil, domain.ValidationError(details)
	}

	return &UpdateEquipmentInput{
		UserID:      input.UserID,
		EquipmentID: input.EquipmentID,
		Name:        name,
		Description: description,
		ImageURL:    imageURL,
	}, nil
}

func normalizeOptionalEquipmentText(value *string, maxLen int, field string, details map[string]string) *string {
	if value == nil {
		return nil
	}

	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	if len(trimmed) > maxLen {
		details[field] = "must be at most " + strconv.Itoa(maxLen) + " characters"
		return nil
	}
	return &trimmed
}
