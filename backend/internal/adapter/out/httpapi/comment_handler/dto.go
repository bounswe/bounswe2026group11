package comment_handler

type createDiscussionCommentBody struct {
	Message  string  `json:"message"`
	ParentID *string `json:"parent_id"`
}

type upsertReviewCommentBody struct {
	Message           string  `json:"message"`
	Rating            int     `json:"rating"`
	ImageConfirmToken *string `json:"image_confirm_token"`
}
