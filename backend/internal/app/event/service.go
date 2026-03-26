package event

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

var validPrivacyLevels = map[string]bool{
	string(domain.PrivacyPublic):    true,
	string(domain.PrivacyProtected): true,
	string(domain.PrivacyPrivate):   true,
}

var validLocationTypes = map[string]bool{
	string(domain.LocationPoint): true,
	string(domain.LocationRoute): true,
}

var validGenders = map[string]bool{
	string(domain.GenderMale):   true,
	string(domain.GenderFemale): true,
	string(domain.GenderOther):  true,
}

// Service implements the event use cases.
type Service struct {
	repo domain.EventRepository
}

// NewService constructs an event Service with the given repository.
func NewService(repo domain.EventRepository) *Service {
	return &Service{repo: repo}
}

// parsedTimes holds the validated and parsed start/end times from user input.
type parsedTimes struct {
	startTime time.Time
	endTime   *time.Time
}

// CreateEvent validates the input, then persists the event with its location,
// tags, and constraints in a single transaction.
func (s *Service) CreateEvent(ctx context.Context, hostID uuid.UUID, input CreateEventInput) (*CreateEventResult, error) {
	times, errs := validateCreateEventInput(input)
	if len(errs) > 0 {
		return nil, domain.ValidationError(errs)
	}

	params := toCreateEventParams(hostID, input, times)

	created, err := s.repo.CreateEvent(ctx, params)
	if err != nil {
		return nil, err
	}

	return toCreateEventResult(created), nil
}

// validateCreateEventInput checks all fields and returns parsed times alongside
// any field-level error messages. Callers must check len(errs) > 0.
func validateCreateEventInput(input CreateEventInput) (parsedTimes, map[string]string) {
	errs := make(map[string]string)
	var times parsedTimes

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

	if !validPrivacyLevels[input.PrivacyLevel] {
		errs["privacy_level"] = "must be one of: PUBLIC, PROTECTED, PRIVATE"
	}

	if !validLocationTypes[input.LocationType] {
		errs["location_type"] = "must be one of: POINT, ROUTE"
	} else {
		validateLocation(input, errs)
	}

	startTime, err := time.Parse(time.RFC3339, input.StartTime)
	if err != nil {
		errs["start_time"] = "must be a valid RFC3339 date-time with timezone"
	} else {
		times.startTime = startTime
	}

	if input.EndTime != nil {
		endTime, err := time.Parse(time.RFC3339, *input.EndTime)
		if err != nil {
			errs["end_time"] = "must be a valid RFC3339 date-time with timezone"
		} else {
			_, startInvalid := errs["start_time"]
			switch {
			case startInvalid:
				// Cannot validate ordering without a valid start time; skip.
			case !endTime.After(times.startTime):
				errs["end_time"] = "end_time must be after start_time"
			default:
				times.endTime = &endTime
			}
		}
	}

	validateTags(input.Tags, errs)
	validateConstraints(input.Constraints, errs)

	if input.PreferredGender != nil && !validGenders[*input.PreferredGender] {
		errs["preferred_gender"] = "must be one of: MALE, FEMALE, OTHER"
	}

	if input.Capacity != nil && *input.Capacity <= 0 {
		errs["capacity"] = "capacity must be a positive integer"
	}

	if input.MinimumAge != nil && (*input.MinimumAge < 0 || *input.MinimumAge > 120) {
		errs["minimum_age"] = "minimum_age must be between 0 and 120"
	}

	return times, errs
}

// validateLocation checks the conditional geometry requirements for point and
// route events.
func validateLocation(input CreateEventInput, errs map[string]string) {
	switch input.LocationType {
	case string(domain.LocationPoint):
		if input.Lat == nil {
			errs["lat"] = "lat is required when location_type is POINT"
		}
		if input.Lon == nil {
			errs["lon"] = "lon is required when location_type is POINT"
		}
		if len(input.RoutePoints) > 0 {
			errs["route_points"] = "route_points must be omitted when location_type is POINT"
		}
	case string(domain.LocationRoute):
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

// toCreateEventParams maps a validated CreateEventInput to the domain params
// expected by the repository.
func toCreateEventParams(hostID uuid.UUID, input CreateEventInput, times parsedTimes) domain.CreateEventParams {
	constraints := make([]domain.EventConstraintParams, len(input.Constraints))
	for i, c := range input.Constraints {
		constraints[i] = domain.EventConstraintParams{
			Type: strings.TrimSpace(c.Type),
			Info: strings.TrimSpace(c.Info),
		}
	}

	var preferredGender *domain.EventParticipantGender
	if input.PreferredGender != nil {
		gender := domain.EventParticipantGender(*input.PreferredGender)
		preferredGender = &gender
	}

	locationType := domain.EventLocationType(input.LocationType)
	privacyLevel := domain.EventPrivacyLevel(input.PrivacyLevel)
	description := strings.TrimSpace(*input.Description)

	params := domain.CreateEventParams{
		HostID:          hostID,
		Title:           strings.TrimSpace(input.Title),
		Description:     description,
		ImageURL:        input.ImageURL,
		CategoryID:      *input.CategoryID,
		StartTime:       times.startTime,
		EndTime:         times.endTime,
		PrivacyLevel:    privacyLevel,
		Capacity:        input.Capacity,
		MinimumAge:      input.MinimumAge,
		PreferredGender: preferredGender,
		LocationType:    locationType,
		Address:         input.Address,
		Tags:            input.Tags,
		Constraints:     constraints,
	}

	switch locationType {
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
