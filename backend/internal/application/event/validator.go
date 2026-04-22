package event

import (
	"strconv"
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

// validateCreateEventInput checks the application-level invariants for create-event
// requests after delivery adapters have parsed wire-specific values.
func validateCreateEventInput(input CreateEventInput, now time.Time) map[string]string {
	errs := make(map[string]string)

	if strings.TrimSpace(input.Title) == "" {
		errs["title"] = "title is required"
	}

	if input.Description == nil || strings.TrimSpace(*input.Description) == "" {
		errs["description"] = "description is required"
	}

	if input.CategoryID == nil {
		errs["category_id"] = "category_id is required"
	} else if *input.CategoryID <= 0 {
		errs["category_id"] = "category_id must be a positive integer"
	}

	if _, ok := domain.ParseEventPrivacyLevel(string(input.PrivacyLevel)); !ok {
		errs["privacy_level"] = "must be one of: PUBLIC, PROTECTED, PRIVATE"
	}

	if _, ok := domain.ParseEventLocationType(string(input.LocationType)); !ok {
		errs["location_type"] = "must be one of: POINT, ROUTE"
	} else {
		validateLocation(input, errs)
	}

	if input.StartTime.IsZero() {
		errs["start_time"] = "start_time is required"
	} else if !input.StartTime.After(now) {
		errs["start_time"] = "start_time must be in the future"
	}

	if input.EndTime != nil && input.StartTime.IsZero() {
		// Cannot validate ordering without a valid start time.
	} else if input.EndTime != nil && !input.EndTime.After(input.StartTime) {
		errs["end_time"] = "end_time must be after start_time"
	}

	validateTags(input.Tags, errs)
	validateConstraints(input.Constraints, errs)

	if input.PreferredGender != nil {
		if _, ok := domain.ParseEventParticipantGender(string(*input.PreferredGender)); !ok {
			errs["preferred_gender"] = "must be one of: MALE, FEMALE, OTHER"
		}
	}

	if input.Capacity != nil && *input.Capacity <= 0 {
		errs["capacity"] = "capacity must be a positive integer"
	}

	if input.MinimumAge != nil && (*input.MinimumAge < 0 || *input.MinimumAge > 120) {
		errs["minimum_age"] = "minimum_age must be between 0 and 120"
	}

	return errs
}

// validateLocation checks the conditional geometry requirements for point and
// route events.
func validateLocation(input CreateEventInput, errs map[string]string) {
	switch input.LocationType {
	case domain.LocationPoint:
		if input.Lat == nil {
			errs["lat"] = "lat is required when location_type is POINT"
		}
		if input.Lon == nil {
			errs["lon"] = "lon is required when location_type is POINT"
		}
		if len(input.RoutePoints) > 0 {
			errs["route_points"] = "route_points must be omitted when location_type is POINT"
		}
	case domain.LocationRoute:
		if input.Lat != nil {
			errs["lat"] = "lat must be omitted when location_type is ROUTE"
		}
		if input.Lon != nil {
			errs["lon"] = "lon must be omitted when location_type is ROUTE"
		}
		if len(input.RoutePoints) < domain.MinRoutePoints {
			errs["route_points"] = "route_points must contain at least 2 points when location_type is ROUTE"
			return
		}
		for i, point := range input.RoutePoints {
			if point.Lat == nil {
				errs["route_points["+strconv.Itoa(i)+"].lat"] = "lat is required"
			}
			if point.Lon == nil {
				errs["route_points["+strconv.Itoa(i)+"].lon"] = "lon is required"
			}
		}
	}
}

// validateTags checks tag count and individual tag lengths, writing any
// errors into errs.
func validateTags(tags []string, errs map[string]string) {
	if len(tags) > domain.MaxEventTags {
		errs["tags"] = "at most 5 tags are allowed"
		return
	}
	for _, tag := range tags {
		if strings.TrimSpace(tag) == "" {
			errs["tags"] = "tags must not be empty"
			return
		}
		if len([]rune(tag)) > domain.MaxTagLength {
			errs["tags"] = "each tag must be at most 20 characters"
			return
		}
	}
}

// validateConstraints checks that every constraint has a non-empty type and
// info, writing any errors into errs.
func validateConstraints(constraints []ConstraintInput, errs map[string]string) {
	if len(constraints) > domain.MaxEventConstraints {
		errs["constraints"] = "at most 5 constraints are allowed"
		return
	}

	for i, c := range constraints {
		if strings.TrimSpace(c.Type) == "" {
			errs["constraints["+strconv.Itoa(i)+"].type"] = "type is required"
		}
		if strings.TrimSpace(c.Info) == "" {
			errs["constraints["+strconv.Itoa(i)+"].info"] = "info is required"
		}
	}
}
