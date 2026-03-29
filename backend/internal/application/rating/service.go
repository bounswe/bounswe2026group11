package rating

import (
	"context"
	"errors"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Service owns rating-specific application behavior.
type Service struct {
	repo     Repository
	settings Settings
	now      func() time.Time
}

var _ UseCase = (*Service)(nil)

// NewService constructs a rating service backed by its own repository.
func NewService(repo Repository, settings Settings) *Service {
	return &Service{
		repo:     repo,
		settings: settings,
		now:      time.Now,
	}
}

// UpsertEventRating creates or updates the caller's rating for an event.
func (s *Service) UpsertEventRating(
	ctx context.Context,
	participantUserID, eventID uuid.UUID,
	input UpsertRatingInput,
) (*RatingResult, error) {
	input.Message = normalizeMessage(input.Message)
	if errs := validateUpsertRatingInput(input); len(errs) > 0 {
		return nil, domain.ValidationError(errs)
	}

	var result *domain.EventRating
	err := s.repo.WithTx(ctx, func(repo Repository) error {
		ratingContext, err := repo.GetEventRatingContext(ctx, eventID, participantUserID)
		if err != nil {
			return s.mapContextError(err)
		}
		if err := s.validateEventRatingContext(ratingContext); err != nil {
			return err
		}

		result, err = repo.UpsertEventRating(ctx, UpsertEventRatingParams{
			EventID:           eventID,
			ParticipantUserID: participantUserID,
			Rating:            input.Rating,
			Message:           input.Message,
		})
		if err != nil {
			return err
		}

		return s.refreshUserScore(ctx, repo, ratingContext.HostUserID)
	})
	if err != nil {
		return nil, err
	}

	return toEventRatingResult(result), nil
}

// DeleteEventRating hard deletes the caller's rating for an event.
func (s *Service) DeleteEventRating(ctx context.Context, participantUserID, eventID uuid.UUID) error {
	return s.repo.WithTx(ctx, func(repo Repository) error {
		ratingContext, err := repo.GetEventRatingContext(ctx, eventID, participantUserID)
		if err != nil {
			return s.mapContextError(err)
		}
		if err := s.validateEventRatingContext(ratingContext); err != nil {
			return err
		}

		deleted, err := repo.DeleteEventRating(ctx, eventID, participantUserID)
		if err != nil {
			return err
		}
		if !deleted {
			return domain.NotFoundError(domain.ErrorCodeEventRatingNotFound, "The requested event rating does not exist.")
		}

		return s.refreshUserScore(ctx, repo, ratingContext.HostUserID)
	})
}

// UpsertParticipantRating creates or updates the host's rating for an approved participant.
func (s *Service) UpsertParticipantRating(
	ctx context.Context,
	hostUserID, eventID, participantUserID uuid.UUID,
	input UpsertRatingInput,
) (*RatingResult, error) {
	input.Message = normalizeMessage(input.Message)
	if errs := validateUpsertRatingInput(input); len(errs) > 0 {
		return nil, domain.ValidationError(errs)
	}

	var result *domain.ParticipantRating
	err := s.repo.WithTx(ctx, func(repo Repository) error {
		ratingContext, err := repo.GetParticipantRatingContext(ctx, eventID, hostUserID, participantUserID)
		if err != nil {
			return s.mapContextError(err)
		}
		if err := s.validateParticipantRatingContext(hostUserID, participantUserID, ratingContext); err != nil {
			return err
		}

		result, err = repo.UpsertParticipantRating(ctx, UpsertParticipantRatingParams{
			EventID:           eventID,
			HostUserID:        hostUserID,
			ParticipantUserID: participantUserID,
			Rating:            input.Rating,
			Message:           input.Message,
		})
		if err != nil {
			return err
		}

		return s.refreshUserScore(ctx, repo, participantUserID)
	})
	if err != nil {
		return nil, err
	}

	return toParticipantRatingResult(result), nil
}

// DeleteParticipantRating hard deletes the host's rating for a participant.
func (s *Service) DeleteParticipantRating(
	ctx context.Context,
	hostUserID, eventID, participantUserID uuid.UUID,
) error {
	return s.repo.WithTx(ctx, func(repo Repository) error {
		ratingContext, err := repo.GetParticipantRatingContext(ctx, eventID, hostUserID, participantUserID)
		if err != nil {
			return s.mapContextError(err)
		}
		if err := s.validateParticipantRatingContext(hostUserID, participantUserID, ratingContext); err != nil {
			return err
		}

		deleted, err := repo.DeleteParticipantRating(ctx, eventID, hostUserID, participantUserID)
		if err != nil {
			return err
		}
		if !deleted {
			return domain.NotFoundError(domain.ErrorCodeParticipantRatingNotFound, "The requested participant rating does not exist.")
		}

		return s.refreshUserScore(ctx, repo, participantUserID)
	})
}

func (s *Service) mapContextError(err error) error {
	if errors.Is(err, domain.ErrNotFound) {
		return domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
	}
	return err
}

func (s *Service) validateEventRatingContext(ratingContext *EventRatingContext) error {
	if ratingContext.IsRequestingHost {
		return domain.ForbiddenError(domain.ErrorCodeHostCannotRateSelf, "The event host cannot rate their own event.")
	}
	if ratingContext.Status == domain.EventStatusCanceled {
		return domain.ConflictError(domain.ErrorCodeRatingNotAllowed, "Ratings are not allowed for canceled events.")
	}
	if !ratingContext.IsApprovedParticipant {
		return domain.ForbiddenError(domain.ErrorCodeRatingNotAllowed, "Only approved participants can rate this event.")
	}

	return s.validateWindow(ratingContext.StartTime, ratingContext.EndTime)
}

func (s *Service) validateParticipantRatingContext(
	hostUserID, participantUserID uuid.UUID,
	ratingContext *ParticipantRatingContext,
) error {
	if hostUserID == participantUserID {
		return domain.ForbiddenError(domain.ErrorCodeHostCannotRateSelf, "The event host cannot rate themselves.")
	}
	if !ratingContext.IsRequestingHost || ratingContext.HostUserID != hostUserID {
		return domain.ForbiddenError(domain.ErrorCodeRatingNotAllowed, "Only the event host can rate participants for this event.")
	}
	if ratingContext.Status == domain.EventStatusCanceled {
		return domain.ConflictError(domain.ErrorCodeRatingNotAllowed, "Ratings are not allowed for canceled events.")
	}
	if !ratingContext.IsApprovedParticipant {
		return domain.ForbiddenError(domain.ErrorCodeRatingNotAllowed, "Only approved participants can be rated for this event.")
	}

	return s.validateWindow(ratingContext.StartTime, ratingContext.EndTime)
}

func (s *Service) validateWindow(startTime time.Time, endTime *time.Time) error {
	window := domain.NewRatingWindow(startTime, endTime)
	if !window.IsActive(s.now().UTC()) {
		return domain.ConflictError(domain.ErrorCodeRatingWindowClosed, "Ratings can only be modified within 7 days after the event ends.")
	}

	return nil
}

func (s *Service) refreshUserScore(ctx context.Context, repo Repository, userID uuid.UUID) error {
	participantAggregate, err := repo.CalculateParticipantAggregate(ctx, userID)
	if err != nil {
		return err
	}

	hostedAggregate, err := repo.CalculateHostedEventAggregate(ctx, userID)
	if err != nil {
		return err
	}

	return repo.UpsertUserScore(ctx, UpsertUserScoreParams{
		UserID:                 userID,
		ParticipantScore:       participantAggregate.Average,
		ParticipantRatingCount: participantAggregate.Count,
		HostedEventScore:       hostedAggregate.Average,
		HostedEventRatingCount: hostedAggregate.Count,
		FinalScore:             calculateFinalScore(participantAggregate, hostedAggregate, s.settings),
	})
}
