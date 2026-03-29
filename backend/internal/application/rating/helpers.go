package rating

import (
	"strings"
	"time"
	"unicode/utf8"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

func normalizeMessage(message *string) *string {
	if message == nil {
		return nil
	}

	trimmed := strings.TrimSpace(*message)
	if trimmed == "" {
		return nil
	}

	return &trimmed
}

func validateUpsertRatingInput(input UpsertRatingInput) map[string]string {
	errs := make(map[string]string)

	if input.Rating < domain.RatingMin || input.Rating > domain.RatingMax {
		errs["rating"] = "rating must be between 1 and 5"
	}

	if input.Message != nil {
		length := utf8.RuneCountInString(*input.Message)
		if length < domain.RatingMessageMinLength || length > domain.RatingMessageMaxLength {
			errs["message"] = "message must be between 10 and 100 characters when provided"
		}
	}

	return errs
}

func toRatingResult(id string, ratingValue int, message *string, createdAt, updatedAt time.Time) *RatingResult {
	return &RatingResult{
		ID:        id,
		Rating:    ratingValue,
		Message:   message,
		CreatedAt: createdAt,
		UpdatedAt: updatedAt,
	}
}

func toEventRatingResult(record *domain.EventRating) *RatingResult {
	return toRatingResult(
		record.ID.String(),
		record.Rating,
		record.Message,
		record.CreatedAt,
		record.UpdatedAt,
	)
}

func toParticipantRatingResult(record *domain.ParticipantRating) *RatingResult {
	return toRatingResult(
		record.ID.String(),
		record.Rating,
		record.Message,
		record.CreatedAt,
		record.UpdatedAt,
	)
}

func calculateBayesianAverage(average *float64, count int, settings Settings) *float64 {
	if average == nil || count == 0 {
		return nil
	}

	m := float64(settings.BayesianM)
	score := ((*average * float64(count)) + (settings.GlobalPrior * m)) / (float64(count) + m)
	return &score
}

func calculateFinalScore(participantAggregate, hostedAggregate *ScoreAggregate, settings Settings) *float64 {
	var (
		participantBayesian = calculateBayesianAverage(participantAggregate.Average, participantAggregate.Count, settings)
		hostedBayesian      = calculateBayesianAverage(hostedAggregate.Average, hostedAggregate.Count, settings)
	)

	switch {
	case participantBayesian == nil && hostedBayesian == nil:
		return nil
	case participantBayesian == nil:
		return hostedBayesian
	case hostedBayesian == nil:
		return participantBayesian
	default:
		score := (0.6 * *hostedBayesian) + (0.4 * *participantBayesian)
		return &score
	}
}
