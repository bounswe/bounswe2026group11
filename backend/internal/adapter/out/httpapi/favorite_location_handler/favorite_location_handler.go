package favorite_location_handler

import (
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	favoritelocationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/favorite_location"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// Handler groups HTTP handlers that delegate to the favorite-location use case.
type Handler struct {
	service favoritelocationapp.UseCase
}

// NewHandler constructs a favorite-location handler.
func NewHandler(service favoritelocationapp.UseCase) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes mounts all favorite-location endpoints under /me.
func RegisterRoutes(router fiber.Router, handler *Handler, auth fiber.Handler) {
	me := router.Group("/me", auth)
	me.Get("/favorite-locations", handler.ListFavoriteLocations)
	me.Post("/favorite-locations", handler.CreateFavoriteLocation)
	me.Patch("/favorite-locations/:id", handler.UpdateFavoriteLocation)
	me.Delete("/favorite-locations/:id", handler.DeleteFavoriteLocation)
}

// ListFavoriteLocations handles GET /me/favorite-locations.
func (h *Handler) ListFavoriteLocations(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)

	result, err := h.service.ListMyFavoriteLocations(c.UserContext(), claims.UserID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	return c.JSON(result)
}

// CreateFavoriteLocation handles POST /me/favorite-locations.
func (h *Handler) CreateFavoriteLocation(c *fiber.Ctx) error {
	var body createFavoriteLocationBody
	if err := c.BodyParser(&body); err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	input, errs := toCreateFavoriteLocationInput(body)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}

	claims := httpapi.UserClaims(c)
	input.UserID = claims.UserID

	result, err := h.service.CreateMyFavoriteLocation(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(result)
}

// UpdateFavoriteLocation handles PATCH /me/favorite-locations/:id.
func (h *Handler) UpdateFavoriteLocation(c *fiber.Ctx) error {
	favoriteLocationID, err := parseFavoriteLocationID(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	var body updateFavoriteLocationBody
	if len(c.Body()) == 0 {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"body": "must not be empty"}))
	}
	if err := c.BodyParser(&body); err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	claims := httpapi.UserClaims(c)
	result, err := h.service.UpdateMyFavoriteLocation(c.UserContext(), favoritelocationapp.UpdateFavoriteLocationInput{
		UserID:             claims.UserID,
		FavoriteLocationID: favoriteLocationID,
		Name:               body.Name,
		Address:            body.Address,
		Lat:                body.Lat,
		Lon:                body.Lon,
	})
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	return c.JSON(result)
}

// DeleteFavoriteLocation handles DELETE /me/favorite-locations/:id.
func (h *Handler) DeleteFavoriteLocation(c *fiber.Ctx) error {
	favoriteLocationID, err := parseFavoriteLocationID(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	if err := h.service.DeleteMyFavoriteLocation(c.UserContext(), claims.UserID, favoriteLocationID); err != nil {
		return httpapi.WriteError(c, err)
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func toCreateFavoriteLocationInput(body createFavoriteLocationBody) (favoritelocationapp.CreateFavoriteLocationInput, map[string]string) {
	input := favoritelocationapp.CreateFavoriteLocationInput{}
	errs := make(map[string]string)

	if body.Name == nil {
		errs["name"] = "is required"
	} else {
		input.Name = *body.Name
	}
	if body.Address == nil {
		errs["address"] = "is required"
	} else {
		input.Address = *body.Address
	}
	if body.Lat == nil {
		errs["lat"] = "is required"
	} else {
		input.Lat = *body.Lat
	}
	if body.Lon == nil {
		errs["lon"] = "is required"
	} else {
		input.Lon = *body.Lon
	}

	return input, errs
}

func parseFavoriteLocationID(c *fiber.Ctx) (uuid.UUID, error) {
	favoriteLocationID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return uuid.Nil, domain.ValidationError(map[string]string{"id": "must be a valid UUID"})
	}
	return favoriteLocationID, nil
}
