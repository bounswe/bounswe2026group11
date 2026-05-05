package comment

import (
	"strings"
	"unicode/utf8"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

const (
	defaultCommentLimit = 25
	maxCommentLimit     = 50
)

func normalizeMessage(message string) string {
	return strings.TrimSpace(message)
}

func validateMessage(message string) map[string]string {
	errs := make(map[string]string)
	length := utf8.RuneCountInString(message)
	if length < domain.CommentMessageMinLength || length > domain.CommentMessageMaxLength {
		errs["message"] = "message must be between 1 and 1000 characters"
	}
	return errs
}

func normalizeLimit(value *int) (int, map[string]string) {
	if value == nil {
		return defaultCommentLimit, nil
	}
	if *value < 1 || *value > maxCommentLimit {
		return 0, map[string]string{"limit": "limit must be between 1 and 50"}
	}
	return *value, nil
}

func toCommentResult(record CommentRecord) CommentResult {
	var parentID *string
	if record.ParentID != nil {
		value := record.ParentID.String()
		parentID = &value
	}

	return CommentResult{
		ID:      record.ID.String(),
		EventID: record.EventID.String(),
		User: CommentAuthorResult{
			ID:          record.User.ID.String(),
			Username:    record.User.Username,
			DisplayName: record.User.DisplayName,
			AvatarURL:   record.User.AvatarURL,
		},
		Type:       string(record.Type),
		Message:    record.Message,
		ParentID:   parentID,
		Rating:     record.Rating,
		ImageURL:   record.ImageURL,
		LikesCount: record.LikesCount,
		ReplyCount: record.ReplyCount,
		CreatedAt:  record.CreatedAt,
		UpdatedAt:  record.UpdatedAt,
	}
}

func toCommentResults(records []CommentRecord) []CommentResult {
	items := make([]CommentResult, len(records))
	for i, record := range records {
		items[i] = toCommentResult(record)
	}
	return items
}

func buildPageInfo(records []CommentRecord, hasNext bool, collection string) (CommentPageInfo, error) {
	if !hasNext || len(records) == 0 {
		return CommentPageInfo{HasNext: hasNext}, nil
	}

	last := records[len(records)-1]
	cursor, err := encodeCommentCursor(CommentCursor{
		Collection: collection,
		CreatedAt:  last.CreatedAt,
		CommentID:  last.ID,
	})
	if err != nil {
		return CommentPageInfo{}, err
	}

	return CommentPageInfo{
		NextCursor: &cursor,
		HasNext:    true,
	}, nil
}
