package favorite_location

import (
	"strings"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

type favoriteLocationCandidate struct {
	Name    string
	Address string
	Lat     float64
	Lon     float64
}

func validateFavoriteLocationCandidate(candidate favoriteLocationCandidate) (*favoriteLocationCandidate, *domain.AppError) {
	details := make(map[string]string)

	name := strings.TrimSpace(candidate.Name)
	switch {
	case name == "":
		details["name"] = "must not be empty"
	case len(name) > maxFavoriteLocationNameLength:
		details["name"] = "must be at most 64 characters"
	}

	address := strings.TrimSpace(candidate.Address)
	switch {
	case address == "":
		details["address"] = "must not be empty"
	case len(address) > maxFavoriteLocationAddressLength:
		details["address"] = "must be at most 512 characters"
	}

	if candidate.Lat < -90 || candidate.Lat > 90 {
		details["lat"] = "must be between -90 and 90"
	}
	if candidate.Lon < -180 || candidate.Lon > 180 {
		details["lon"] = "must be between -180 and 180"
	}

	if len(details) > 0 {
		return nil, domain.ValidationError(details)
	}

	return &favoriteLocationCandidate{
		Name:    name,
		Address: address,
		Lat:     candidate.Lat,
		Lon:     candidate.Lon,
	}, nil
}
