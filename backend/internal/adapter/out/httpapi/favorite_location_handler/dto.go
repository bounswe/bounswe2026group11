package favorite_location_handler

// createFavoriteLocationBody is the JSON request body for POST /me/favorite-locations.
type createFavoriteLocationBody struct {
	Name    *string  `json:"name"`
	Address *string  `json:"address"`
	Lat     *float64 `json:"lat"`
	Lon     *float64 `json:"lon"`
}

// updateFavoriteLocationBody is the JSON request body for PATCH /me/favorite-locations/:id.
type updateFavoriteLocationBody struct {
	Name    *string  `json:"name"`
	Address *string  `json:"address"`
	Lat     *float64 `json:"lat"`
	Lon     *float64 `json:"lon"`
}
