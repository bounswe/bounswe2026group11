package event

import "time"

// CreateEventInput is the validated input for creating an event.
type CreateEventInput struct {
	Title           string
	Description     *string
	ImageURL        *string
	CategoryID      *int
	Address         *string
	Lat             *float64
	Lon             *float64
	RoutePoints     []RoutePointInput
	LocationType    string
	StartTime       string
	EndTime         *string
	Capacity        *int
	PrivacyLevel    string
	Tags            []string
	Constraints     []ConstraintInput
	MinimumAge      *int
	PreferredGender *string
}

// ConstraintInput is a single constraint attached to an event.
type ConstraintInput struct {
	Type string
	Info string
}

// RoutePointInput is a single coordinate in a route geometry.
type RoutePointInput struct {
	Lat *float64
	Lon *float64
}

// CreateEventResult is returned after a successful event creation.
type CreateEventResult struct {
	ID           string     `json:"id"`
	Title        string     `json:"title"`
	PrivacyLevel string     `json:"privacy_level"`
	Status       string     `json:"status"`
	StartTime    time.Time  `json:"start_time"`
	EndTime      *time.Time `json:"end_time,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}
