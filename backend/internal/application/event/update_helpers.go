package event

import (
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

func buildUpdateEventParams(snapshot *EventEditSnapshot, input UpdateEventInput, now time.Time) (UpdateEventParams, []string, []string, map[string]string) {
	errs := make(map[string]string)
	current := snapshot.Event
	params := UpdateEventParams{
		EventID:      current.ID,
		Title:        current.Title,
		Description:  current.Description,
		CategoryID:   current.CategoryID,
		StartTime:    current.StartTime,
		EndTime:      current.EndTime,
		Capacity:     current.Capacity,
		LocationType: snapshot.Location.Type,
		Address:      snapshot.Location.Address,
		Constraints:  toConstraintParams(snapshot.Constraints),
	}
	if snapshot.Location.Point != nil {
		params.Point = &domain.GeoPoint{Lat: snapshot.Location.Point.Lat, Lon: snapshot.Location.Point.Lon}
	}
	params.RoutePoints = append([]domain.GeoPoint{}, snapshot.Location.RoutePoints...)

	changed := map[string]bool{}
	triggered := map[string]bool{}

	if input.Title != nil {
		title := strings.TrimSpace(*input.Title)
		if title == "" {
			errs["title"] = "title must not be empty"
		} else if title != current.Title {
			params.Title = title
			changed["title"] = true
			triggered["title"] = true
		}
	}
	if input.Description.Set {
		description := trimOptionalString(input.Description.Value)
		if !stringPtrEqual(description, current.Description) {
			params.Description = description
			changed["description"] = true
			triggered["description"] = true
		}
	}
	if input.CategoryID.Set {
		if input.CategoryID.Value != nil && *input.CategoryID.Value <= 0 {
			errs["category_id"] = "category_id must be a positive integer"
		} else if !intPtrEqual(input.CategoryID.Value, current.CategoryID) {
			params.CategoryID = copyIntPtr(input.CategoryID.Value)
			changed["category_id"] = true
			triggered["category_id"] = true
		}
	}
	if input.StartTime != nil {
		if input.StartTime.IsZero() {
			errs["start_time"] = "start_time is required"
		} else if !input.StartTime.After(now) {
			errs["start_time"] = "start_time must be in the future"
		} else if !input.StartTime.Equal(current.StartTime) {
			params.StartTime = *input.StartTime
			changed["start_time"] = true
			triggered["start_time"] = true
		}
	}
	if input.EndTime.Set {
		if !timePtrEqual(input.EndTime.Value, current.EndTime) {
			params.EndTime = copyTimePtr(input.EndTime.Value)
			changed["end_time"] = true
			triggered["end_time"] = true
		}
	}
	if input.Capacity.Set {
		if input.Capacity.Value != nil && *input.Capacity.Value <= 0 {
			errs["capacity"] = "capacity must be a positive integer"
		} else if !intPtrEqual(input.Capacity.Value, current.Capacity) {
			params.Capacity = copyIntPtr(input.Capacity.Value)
			changed["capacity"] = true
		}
	}

	if params.EndTime != nil && !params.EndTime.After(params.StartTime) {
		errs["end_time"] = "end_time must be after start_time"
	}

	mergeLocationUpdate(snapshot, input, &params, changed, triggered, errs)

	if input.Constraints != nil {
		constraints := normalizeConstraintInputs(*input.Constraints, errs)
		if !constraintParamsEqual(constraints, params.Constraints) {
			if hasAddedConstraint(params.Constraints, constraints) {
				triggered["constraints"] = true
			}
			params.Constraints = constraints
			changed["constraints"] = true
			params.ConstraintsChanged = true
		}
	}

	if len(changed) > 0 {
		params.Changed = true
	}
	return params, sortedKeys(changed), sortedKeys(triggered), errs
}

func mergeLocationUpdate(
	snapshot *EventEditSnapshot,
	input UpdateEventInput,
	params *UpdateEventParams,
	changed map[string]bool,
	triggered map[string]bool,
	errs map[string]string,
) {
	locationTouched := input.Address.Set || input.LocationType != nil || input.Lat != nil || input.Lon != nil || input.RoutePoints != nil
	if !locationTouched {
		return
	}

	if input.Address.Set {
		params.Address = trimOptionalString(input.Address.Value)
	}
	if input.LocationType != nil {
		params.LocationType = *input.LocationType
	}

	switch params.LocationType {
	case domain.LocationPoint:
		if input.RoutePoints != nil {
			errs["route_points"] = "route_points must be omitted when location_type is POINT"
		}
		point := params.Point
		if input.Lat != nil || input.Lon != nil || snapshot.Location.Type != domain.LocationPoint {
			if input.Lat == nil {
				errs["lat"] = "lat is required when location_type is POINT"
			}
			if input.Lon == nil {
				errs["lon"] = "lon is required when location_type is POINT"
			}
			if input.Lat != nil && input.Lon != nil {
				point = &domain.GeoPoint{Lat: *input.Lat, Lon: *input.Lon}
			}
		}
		params.Point = point
		params.RoutePoints = nil
		if params.Point == nil {
			errs["lat"] = "lat is required when location_type is POINT"
			errs["lon"] = "lon is required when location_type is POINT"
		}
	case domain.LocationRoute:
		if input.Lat != nil {
			errs["lat"] = "lat must be omitted when location_type is ROUTE"
		}
		if input.Lon != nil {
			errs["lon"] = "lon must be omitted when location_type is ROUTE"
		}
		if input.RoutePoints != nil {
			for i, point := range *input.RoutePoints {
				if point.Lat == nil {
					errs["route_points["+strconv.Itoa(i)+"].lat"] = "lat is required"
				}
				if point.Lon == nil {
					errs["route_points["+strconv.Itoa(i)+"].lon"] = "lon is required"
				}
			}
			if len(errs) == 0 {
				params.RoutePoints = toDomainRoutePoints(*input.RoutePoints)
			}
		} else if snapshot.Location.Type != domain.LocationRoute {
			params.RoutePoints = nil
		}
		params.Point = nil
		if len(params.RoutePoints) < domain.MinRoutePoints {
			errs["route_points"] = "route_points must contain at least 2 points when location_type is ROUTE"
		}
	default:
		errs["location_type"] = "must be one of: POINT, ROUTE"
	}

	if !locationEqual(snapshot.Location, *params) {
		changed["location"] = true
		triggered["location"] = true
		params.LocationChanged = true
	}
}

func normalizeConstraintInputs(inputs []ConstraintInput, errs map[string]string) []EventConstraintParams {
	if len(inputs) > domain.MaxEventConstraints {
		errs["constraints"] = "at most 5 constraints are allowed"
		return nil
	}

	constraints := make([]EventConstraintParams, len(inputs))
	for i, c := range inputs {
		constraintType := strings.TrimSpace(c.Type)
		info := strings.TrimSpace(c.Info)
		if constraintType == "" {
			errs["constraints["+strconv.Itoa(i)+"].type"] = "type is required"
		}
		if info == "" {
			errs["constraints["+strconv.Itoa(i)+"].info"] = "info is required"
		}
		constraints[i] = EventConstraintParams{Type: constraintType, Info: info}
	}
	return constraints
}

func toConstraintParams(records []EventDetailConstraintRecord) []EventConstraintParams {
	params := make([]EventConstraintParams, len(records))
	for i, record := range records {
		params[i] = EventConstraintParams(record)
	}
	return params
}

func locationEqual(current EventDetailLocationRecord, params UpdateEventParams) bool {
	if current.Type != params.LocationType || !stringPtrEqual(current.Address, params.Address) {
		return false
	}
	switch params.LocationType {
	case domain.LocationPoint:
		if current.Point == nil || params.Point == nil {
			return current.Point == nil && params.Point == nil
		}
		return current.Point.Lat == params.Point.Lat && current.Point.Lon == params.Point.Lon
	case domain.LocationRoute:
		if len(current.RoutePoints) != len(params.RoutePoints) {
			return false
		}
		for i := range current.RoutePoints {
			if current.RoutePoints[i] != params.RoutePoints[i] {
				return false
			}
		}
		return true
	default:
		return true
	}
}

func constraintParamsEqual(a, b []EventConstraintParams) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func hasAddedConstraint(oldConstraints, newConstraints []EventConstraintParams) bool {
	oldSet := make(map[string]struct{}, len(oldConstraints))
	for _, c := range oldConstraints {
		oldSet[constraintKey(c)] = struct{}{}
	}
	for _, c := range newConstraints {
		if _, ok := oldSet[constraintKey(c)]; !ok {
			return true
		}
	}
	return false
}

func constraintKey(c EventConstraintParams) string {
	return c.Type + "\x00" + c.Info
}

func sortedKeys(values map[string]bool) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func trimOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	return &trimmed
}

func stringPtrEqual(a, b *string) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func intPtrEqual(a, b *int) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func timePtrEqual(a, b *time.Time) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return a.Equal(*b)
}

func copyIntPtr(value *int) *int {
	if value == nil {
		return nil
	}
	copied := *value
	return &copied
}

func copyTimePtr(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	copied := *value
	return &copied
}
