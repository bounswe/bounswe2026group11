package rating_handler

// upsertRatingBody is the shared JSON request body for PUT rating endpoints.
type upsertRatingBody struct {
	Rating  int     `json:"rating"`
	Message *string `json:"message"`
}
