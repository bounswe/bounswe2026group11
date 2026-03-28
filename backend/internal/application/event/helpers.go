package event

import (
	"strings"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// toCreateEventResult maps the created domain.Event to the API response shape.
func toCreateEventResult(e *domain.Event) *CreateEventResult {
	return &CreateEventResult{
		ID:           e.ID.String(),
		Title:        e.Title,
		PrivacyLevel: string(e.PrivacyLevel),
		Status:       string(e.Status),
		StartTime:    e.StartTime,
		EndTime:      e.EndTime,
		CreatedAt:    e.CreatedAt,
	}
}

// toCreateEventParams maps a validated CreateEventInput to the repository params
// expected by the repository.
func toCreateEventParams(hostID uuid.UUID, input CreateEventInput) CreateEventParams {
	constraints := make([]EventConstraintParams, len(input.Constraints))
	for i, c := range input.Constraints {
		constraints[i] = EventConstraintParams{
			Type: strings.TrimSpace(c.Type),
			Info: strings.TrimSpace(c.Info),
		}
	}

	description := strings.TrimSpace(*input.Description)
	params := CreateEventParams{
		HostID:          hostID,
		Title:           strings.TrimSpace(input.Title),
		Description:     description,
		ImageURL:        input.ImageURL,
		CategoryID:      *input.CategoryID,
		StartTime:       input.StartTime,
		EndTime:         input.EndTime,
		PrivacyLevel:    input.PrivacyLevel,
		Capacity:        input.Capacity,
		MinimumAge:      input.MinimumAge,
		PreferredGender: input.PreferredGender,
		LocationType:    input.LocationType,
		Address:         input.Address,
		Tags:            input.Tags,
		Constraints:     constraints,
	}

	switch input.LocationType {
	case domain.LocationPoint:
		params.Point = &domain.GeoPoint{
			Lat: *input.Lat,
			Lon: *input.Lon,
		}
	case domain.LocationRoute:
		params.RoutePoints = toDomainRoutePoints(input.RoutePoints)
	}

	return params
}

func toDomainRoutePoints(points []RoutePointInput) []domain.GeoPoint {
	domainPoints := make([]domain.GeoPoint, len(points))
	for i, point := range points {
		domainPoints[i] = domain.GeoPoint{
			Lat: *point.Lat,
			Lon: *point.Lon,
		}
	}
	return domainPoints
}
