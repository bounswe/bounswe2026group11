package rating

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/uow"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// BadgeEvaluator is the local port for triggering rating-driven badge
// evaluation after rating writes. It is intentionally minimal so the rating
// service does not depend on the full badge use case.
type BadgeEvaluator interface {
	EvaluateHostBadges(ctx context.Context, hostID uuid.UUID) error
	EvaluateParticipationBadges(ctx context.Context, userID uuid.UUID) error
}

// Service owns rating-specific application behavior.
type Service struct {
	repo           Repository
	unitOfWork     uow.UnitOfWork
	settings       Settings
	now            func() time.Time
	badgeEvaluator BadgeEvaluator
}

var _ UseCase = (*Service)(nil)

// NewService constructs a rating service backed by its own repository.
func NewService(repo Repository, unitOfWork uow.UnitOfWork, settings Settings) *Service {
	return &Service{
		repo:       repo,
		unitOfWork: unitOfWork,
		settings:   settings,
		now:        time.Now,
	}
}

// SetBadgeEvaluator wires in the badge use case so the rating service can
// re-evaluate host and participant badges after rating changes.
func (s *Service) SetBadgeEvaluator(evaluator BadgeEvaluator) {
	s.badgeEvaluator = evaluator
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

	var (
		result *domain.EventRating
		hostID uuid.UUID
	)
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		ratingContext, err := s.repo.GetEventRatingContext(ctx, eventID, participantUserID)
		if err != nil {
			return s.mapContextError(err)
		}
		if err := s.validateEventRatingContext(ratingContext); err != nil {
			return err
		}

		result, err = s.repo.UpsertEventRating(ctx, UpsertEventRatingParams{
			EventID:           eventID,
			ParticipantUserID: participantUserID,
			Rating:            input.Rating,
			Message:           input.Message,
		})
		if err != nil {
			return err
		}

		hostID = ratingContext.HostUserID
		return s.refreshUserScore(ctx, s.repo, ratingContext.HostUserID)
	})
	if err != nil {
		return nil, err
	}

	s.evaluateHostBadges(ctx, hostID)
	return toEventRatingResult(result), nil
}

// DeleteEventRating hard deletes the caller's rating for an event.
func (s *Service) DeleteEventRating(ctx context.Context, participantUserID, eventID uuid.UUID) error {
	return s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		ratingContext, err := s.repo.GetEventRatingContext(ctx, eventID, participantUserID)
		if err != nil {
			return s.mapContextError(err)
		}
		if err := s.validateEventRatingContext(ratingContext); err != nil {
			return err
		}

		deleted, err := s.repo.DeleteEventRating(ctx, eventID, participantUserID)
		if err != nil {
			return err
		}
		if !deleted {
			return domain.NotFoundError(domain.ErrorCodeEventRatingNotFound, "The requested event rating does not exist.")
		}

		return s.refreshUserScore(ctx, s.repo, ratingContext.HostUserID)
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
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		ratingContext, err := s.repo.GetParticipantRatingContext(ctx, eventID, hostUserID, participantUserID)
		if err != nil {
			return s.mapContextError(err)
		}
		if err := s.validateParticipantRatingContext(hostUserID, participantUserID, ratingContext); err != nil {
			return err
		}

		result, err = s.repo.UpsertParticipantRating(ctx, UpsertParticipantRatingParams{
			EventID:           eventID,
			HostUserID:        hostUserID,
			ParticipantUserID: participantUserID,
			Rating:            input.Rating,
			Message:           input.Message,
		})
		if err != nil {
			return err
		}

		return s.refreshUserScore(ctx, s.repo, participantUserID)
	})
	if err != nil {
		return nil, err
	}

	s.evaluateParticipationBadges(ctx, participantUserID)
	return toParticipantRatingResult(result), nil
}

// DeleteParticipantRating hard deletes the host's rating for a participant.
func (s *Service) DeleteParticipantRating(
	ctx context.Context,
	hostUserID, eventID, participantUserID uuid.UUID,
) error {
	return s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		ratingContext, err := s.repo.GetParticipantRatingContext(ctx, eventID, hostUserID, participantUserID)
		if err != nil {
			return s.mapContextError(err)
		}
		if err := s.validateParticipantRatingContext(hostUserID, participantUserID, ratingContext); err != nil {
			return err
		}

		deleted, err := s.repo.DeleteParticipantRating(ctx, eventID, hostUserID, participantUserID)
		if err != nil {
			return err
		}
		if !deleted {
			return domain.NotFoundError(domain.ErrorCodeParticipantRatingNotFound, "The requested participant rating does not exist.")
		}

		return s.refreshUserScore(ctx, s.repo, participantUserID)
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

// evaluateHostBadges runs host-side badge evaluation as a best-effort hook so
// transient failures never fail the parent rating operation.
func (s *Service) evaluateHostBadges(ctx context.Context, hostID uuid.UUID) {
	if s.badgeEvaluator == nil {
		return
	}
	if err := s.badgeEvaluator.EvaluateHostBadges(ctx, hostID); err != nil {
		slog.WarnContext(ctx, "host badge evaluation failed",
			slog.String("operation", "rating.evaluate_host_badges"),
			slog.String("host_id", hostID.String()),
			slog.String("error", err.Error()),
		)
	}
}

// evaluateParticipationBadges runs participant-side badge evaluation as a
// best-effort hook so transient failures never fail the parent rating
// operation.
func (s *Service) evaluateParticipationBadges(ctx context.Context, userID uuid.UUID) {
	if s.badgeEvaluator == nil {
		return
	}
	if err := s.badgeEvaluator.EvaluateParticipationBadges(ctx, userID); err != nil {
		slog.WarnContext(ctx, "participation badge evaluation failed",
			slog.String("operation", "rating.evaluate_participation_badges"),
			slog.String("user_id", userID.String()),
			slog.String("error", err.Error()),
		)
	}
}
