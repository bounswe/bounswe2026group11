package notification_handler

import (
	"log/slog"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	notificationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/notification"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// Handler groups HTTP handlers that delegate to the notification use case.
type Handler struct {
	service notificationapp.UseCase
}

func NewHandler(service notificationapp.UseCase) *Handler {
	return &Handler{service: service}
}

func RegisterRoutes(router fiber.Router, handler *Handler, auth fiber.Handler) {
	me := router.Group("/me", auth)
	me.Put("/push-devices/:installation_id", handler.RegisterPushDevice)
	me.Delete("/push-devices/:installation_id", handler.UnregisterPushDevice)
}

// RegisterPushDevice handles PUT /me/push-devices/:installation_id.
func (h *Handler) RegisterPushDevice(c *fiber.Ctx) error {
	installationID, err := parseInstallationID(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	var body registerPushDeviceBody
	if err := c.BodyParser(&body); err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	input, errs := toRegisterDeviceInput(body)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}

	claims := httpapi.UserClaims(c)
	input.UserID = claims.UserID
	input.InstallationID = installationID

	result, err := h.service.RegisterDevice(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"push device registered",
		httpapi.OperationAttr("notification.push_device.register"),
		httpapi.UserIDAttr(claims.UserID),
		slog.Int("active_device_count", result.ActiveDeviceCount),
	)

	return c.JSON(registerPushDeviceResponse{
		InstallationID:    result.InstallationID,
		Platform:          result.Platform.String(),
		ActiveDeviceCount: result.ActiveDeviceCount,
		UpdatedAt:         result.UpdatedAt,
	})
}

// UnregisterPushDevice handles DELETE /me/push-devices/:installation_id.
func (h *Handler) UnregisterPushDevice(c *fiber.Ctx) error {
	installationID, err := parseInstallationID(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	if err := h.service.UnregisterDevice(c.UserContext(), claims.UserID, installationID); err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"push device unregistered",
		httpapi.OperationAttr("notification.push_device.unregister"),
		httpapi.UserIDAttr(claims.UserID),
	)

	return c.SendStatus(fiber.StatusNoContent)
}

func parseInstallationID(c *fiber.Ctx) (uuid.UUID, error) {
	installationID, err := uuid.Parse(c.Params("installation_id"))
	if err != nil {
		return uuid.Nil, domain.ValidationError(map[string]string{"installation_id": "must be a valid UUID"})
	}
	return installationID, nil
}

func toRegisterDeviceInput(body registerPushDeviceBody) (notificationapp.RegisterDeviceInput, map[string]string) {
	input := notificationapp.RegisterDeviceInput{DeviceInfo: body.DeviceInfo}
	errs := map[string]string{}
	if body.FCMToken == nil {
		errs["fcm_token"] = "is required"
	} else {
		input.FCMToken = *body.FCMToken
	}
	if body.Platform == nil {
		errs["platform"] = "is required"
	} else {
		input.Platform = *body.Platform
	}
	return input, errs
}
