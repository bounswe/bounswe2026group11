package event_handler

// createEventBody is the JSON request body for POST /events.
type createEventBody struct {
	Title           string           `json:"title"`
	Description     *string          `json:"description"`
	ImageURL        *string          `json:"image_url"`
	CategoryID      *int             `json:"category_id"`
	Address         *string          `json:"address"`
	Lat             *float64         `json:"lat"`
	Lon             *float64         `json:"lon"`
	RoutePoints     []routePointBody `json:"route_points"`
	LocationType    string           `json:"location_type"`
	StartTime       string           `json:"start_time"`
	EndTime         *string          `json:"end_time"`
	Capacity        *int             `json:"capacity"`
	PrivacyLevel    string           `json:"privacy_level"`
	Tags            []string         `json:"tags"`
	Constraints     []constraintBody `json:"constraints"`
	MinimumAge      *int             `json:"minimum_age"`
	PreferredGender *string          `json:"preferred_gender"`
}

// requestJoinBody is the JSON request body for POST /events/:id/join-request.
type requestJoinBody struct {
	Message *string `json:"message"`
}

// constraintBody represents a single participation constraint in the request.
type constraintBody struct {
	Type string `json:"type"`
	Info string `json:"info"`
}

// routePointBody represents a single route coordinate in the request.
type routePointBody struct {
	Lat *float64 `json:"lat"`
	Lon *float64 `json:"lon"`
}
