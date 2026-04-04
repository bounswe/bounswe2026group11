package favorite_location

import (
	"context"
	"errors"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/uow"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Service owns favorite-location application behavior.
type Service struct {
	repo       Repository
	unitOfWork uow.UnitOfWork
}

var _ UseCase = (*Service)(nil)

// NewService constructs a favorite-location service backed by its repository.
func NewService(repo Repository, unitOfWork uow.UnitOfWork) *Service {
	return &Service{
		repo:       repo,
		unitOfWork: unitOfWork,
	}
}

// ListMyFavoriteLocations returns the authenticated user's favorite locations.
func (s *Service) ListMyFavoriteLocations(ctx context.Context, userID uuid.UUID) (*ListFavoriteLocationsResult, error) {
	locations, err := s.repo.ListByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	items := make([]FavoriteLocationResult, len(locations))
	for i, location := range locations {
		items[i] = toFavoriteLocationResult(location)
	}

	return &ListFavoriteLocationsResult{Items: items}, nil
}

// CreateMyFavoriteLocation validates and persists a new favorite location for the authenticated user.
func (s *Service) CreateMyFavoriteLocation(ctx context.Context, input CreateFavoriteLocationInput) (*FavoriteLocationResult, error) {
	validated, appErr := validateFavoriteLocationCandidate(favoriteLocationCandidate{
		Name:    input.Name,
		Address: input.Address,
		Lat:     input.Lat,
		Lon:     input.Lon,
	})
	if appErr != nil {
		return nil, appErr
	}

	var location *domain.FavoriteLocation
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		var err error
		location, err = s.repo.Create(ctx, CreateFavoriteLocationParams{
			UserID:  input.UserID,
			Name:    validated.Name,
			Address: validated.Address,
			Lat:     validated.Lat,
			Lon:     validated.Lon,
		})
		return err
	})
	if err != nil {
		if errors.Is(err, ErrFavoriteLocationLimitExceeded) {
			return nil, domain.ConflictError(
				domain.ErrorCodeFavoriteLocationLimitExceeded,
				"Users can save at most 3 favorite locations.",
			)
		}
		return nil, err
	}

	result := toFavoriteLocationResult(*location)
	return &result, nil
}

// UpdateMyFavoriteLocation applies a partial update to one of the authenticated user's favorite locations.
func (s *Service) UpdateMyFavoriteLocation(ctx context.Context, input UpdateFavoriteLocationInput) (*FavoriteLocationResult, error) {
	current, err := s.repo.GetByIDForUser(ctx, input.UserID, input.FavoriteLocationID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, favoriteLocationNotFoundError()
		}
		return nil, err
	}

	candidate := favoriteLocationCandidate{
		Name:    current.Name,
		Address: current.Address,
		Lat:     current.Point.Lat,
		Lon:     current.Point.Lon,
	}
	if input.Name != nil {
		candidate.Name = *input.Name
	}
	if input.Address != nil {
		candidate.Address = *input.Address
	}
	if input.Lat != nil {
		candidate.Lat = *input.Lat
	}
	if input.Lon != nil {
		candidate.Lon = *input.Lon
	}

	validated, appErr := validateFavoriteLocationCandidate(candidate)
	if appErr != nil {
		return nil, appErr
	}

	location, err := s.repo.Update(ctx, UpdateFavoriteLocationParams{
		UserID:             input.UserID,
		FavoriteLocationID: input.FavoriteLocationID,
		Name:               validated.Name,
		Address:            validated.Address,
		Lat:                validated.Lat,
		Lon:                validated.Lon,
	})
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, favoriteLocationNotFoundError()
		}
		return nil, err
	}

	result := toFavoriteLocationResult(*location)
	return &result, nil
}

// DeleteMyFavoriteLocation removes one of the authenticated user's favorite locations.
func (s *Service) DeleteMyFavoriteLocation(ctx context.Context, userID, favoriteLocationID uuid.UUID) error {
	err := s.repo.Delete(ctx, userID, favoriteLocationID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return favoriteLocationNotFoundError()
		}
		return err
	}

	return nil
}

func toFavoriteLocationResult(location domain.FavoriteLocation) FavoriteLocationResult {
	return FavoriteLocationResult{
		ID:      location.ID.String(),
		Name:    location.Name,
		Address: location.Address,
		Lat:     location.Point.Lat,
		Lon:     location.Point.Lon,
	}
}

func favoriteLocationNotFoundError() *domain.AppError {
	return domain.NotFoundError(
		domain.ErrorCodeFavoriteLocationNotFound,
		"The requested favorite location does not exist.",
	)
}
