package notification_handler

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	notificationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/notification"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// Handler groups HTTP handlers that delegate to the notification use case.
type Handler struct {
	service  notificationapp.UseCase
	realtime notificationapp.RealtimeBroker
}

func NewHandler(service notificationapp.UseCase, realtime ...notificationapp.RealtimeBroker) *Handler {
	handler := &Handler{service: service}
	if len(realtime) > 0 {
		handler.realtime = realtime[0]
	}
	return handler
}

func RegisterRoutes(router fiber.Router, handler *Handler, auth fiber.Handler) {
	me := router.Group("/me", auth)
	me.Put("/push-devices/:installation_id", handler.RegisterPushDevice)
	me.Delete("/push-devices/:installation_id", handler.UnregisterPushDevice)
	me.Get("/notifications/stream", handler.StreamNotifications)
	me.Get("/notifications/unread", handler.ListUnreadNotifications)
	me.Get("/notifications/unread-count", handler.GetUnreadNotificationCount)
	me.Patch("/notifications/read", handler.MarkAllNotificationsRead)
	me.Get("/notifications", handler.ListNotifications)
	me.Patch("/notifications/:notification_id/read", handler.MarkNotificationRead)
	me.Delete("/notifications/:notification_id", handler.DeleteNotification)
	me.Delete("/notifications", handler.DeleteAllNotifications)
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

// ListNotifications handles GET /me/notifications.
func (h *Handler) ListNotifications(c *fiber.Ctx) error {
	return h.listNotifications(c, false)
}

// ListUnreadNotifications handles GET /me/notifications/unread.
func (h *Handler) ListUnreadNotifications(c *fiber.Ctx) error {
	return h.listNotifications(c, true)
}

func (h *Handler) listNotifications(c *fiber.Ctx, onlyUnread bool) error {
	input, err := parseListNotificationsInput(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	input.UserID = httpapi.UserClaims(c).UserID
	input.OnlyUnread = onlyUnread

	result, err := h.service.ListNotifications(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	return c.JSON(toListNotificationsResponse(result))
}

// GetUnreadNotificationCount handles GET /me/notifications/unread-count.
func (h *Handler) GetUnreadNotificationCount(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)
	result, err := h.service.CountUnreadNotifications(c.UserContext(), claims.UserID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(unreadCountResponse{UnreadCount: result.UnreadCount})
}

// MarkNotificationRead handles PATCH /me/notifications/:notification_id/read.
func (h *Handler) MarkNotificationRead(c *fiber.Ctx) error {
	notificationID, err := parseNotificationID(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	if err := h.service.MarkNotificationRead(c.UserContext(), claims.UserID, notificationID); err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// MarkAllNotificationsRead handles PATCH /me/notifications/read.
func (h *Handler) MarkAllNotificationsRead(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)
	result, err := h.service.MarkAllNotificationsRead(c.UserContext(), claims.UserID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(markAllReadResponse{UpdatedCount: result.UpdatedCount})
}

// DeleteNotification handles DELETE /me/notifications/:notification_id.
func (h *Handler) DeleteNotification(c *fiber.Ctx) error {
	notificationID, err := parseNotificationID(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	if err := h.service.DeleteNotification(c.UserContext(), claims.UserID, notificationID); err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// DeleteAllNotifications handles DELETE /me/notifications.
func (h *Handler) DeleteAllNotifications(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)
	if err := h.service.DeleteAllNotifications(c.UserContext(), claims.UserID); err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// StreamNotifications handles GET /me/notifications/stream.
func (h *Handler) StreamNotifications(c *fiber.Ctx) error {
	if h.realtime == nil {
		return httpapi.WriteError(c, fmt.Errorf("notification realtime broker is not configured"))
	}

	claims := httpapi.UserClaims(c)
	sub := h.realtime.Subscribe(claims.UserID)
	if sub == nil {
		return httpapi.WriteError(c, fmt.Errorf("notification realtime broker is not configured"))
	}

	c.Set(fiber.HeaderContentType, "text/event-stream")
	c.Set(fiber.HeaderCacheControl, "no-cache")
	c.Set(fiber.HeaderConnection, "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		defer sub.Cancel()
		ticker := time.NewTicker(20 * time.Second)
		defer ticker.Stop()

		if !writeSSE(w, "heartbeat", "", []byte("{}")) {
			return
		}

		for {
			select {
			case notification, ok := <-sub.Events:
				if !ok {
					return
				}
				payload, err := json.Marshal(toNotificationResponse(notification))
				if err != nil {
					return
				}
				if !writeSSE(w, "notification", notification.ID.String(), payload) {
					return
				}
			case <-ticker.C:
				if !writeSSE(w, "heartbeat", "", []byte("{}")) {
					return
				}
			}
		}
	})

	return nil
}

func parseInstallationID(c *fiber.Ctx) (uuid.UUID, error) {
	installationID, err := uuid.Parse(c.Params("installation_id"))
	if err != nil {
		return uuid.Nil, domain.ValidationError(map[string]string{"installation_id": "must be a valid UUID"})
	}
	return installationID, nil
}

func parseNotificationID(c *fiber.Ctx) (uuid.UUID, error) {
	notificationID, err := uuid.Parse(c.Params("notification_id"))
	if err != nil {
		return uuid.Nil, domain.ValidationError(map[string]string{"notification_id": "must be a valid UUID"})
	}
	return notificationID, nil
}

func parseListNotificationsInput(c *fiber.Ctx) (notificationapp.ListNotificationsInput, error) {
	input := notificationapp.ListNotificationsInput{}
	if rawLimit := strings.TrimSpace(c.Query("limit")); rawLimit != "" {
		limit, err := strconv.Atoi(rawLimit)
		if err != nil {
			return input, domain.ValidationError(map[string]string{"limit": "must be an integer"})
		}
		input.Limit = &limit
	}
	if rawCursor := strings.TrimSpace(c.Query("cursor")); rawCursor != "" {
		input.Cursor = &rawCursor
	}
	return input, nil
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

func toListNotificationsResponse(result *notificationapp.ListNotificationsResult) listNotificationsResponse {
	items := make([]notificationResponse, len(result.Items))
	for i, notification := range result.Items {
		items[i] = toNotificationResponse(notification)
	}
	return listNotificationsResponse{
		Items: items,
		PageInfo: notificationPageInfo{
			NextCursor: result.PageInfo.NextCursor,
			HasNext:    result.PageInfo.HasNext,
		},
	}
}

func toNotificationResponse(notification domain.Notification) notificationResponse {
	var eventID *string
	if notification.EventID != nil {
		value := notification.EventID.String()
		eventID = &value
	}
	data := notification.Data
	if data == nil {
		data = map[string]string{}
	}
	return notificationResponse{
		ID:        notification.ID.String(),
		EventID:   eventID,
		Title:     notification.Title,
		Body:      notification.Body,
		Type:      notification.Type,
		DeepLink:  notification.DeepLink,
		ImageURL:  notification.ImageURL,
		Data:      data,
		IsRead:    notification.IsRead,
		ReadAt:    notification.ReadAt,
		CreatedAt: notification.CreatedAt,
	}
}

func writeSSE(w *bufio.Writer, event, id string, data []byte) bool {
	if id != "" {
		if _, err := fmt.Fprintf(w, "id: %s\n", id); err != nil {
			return false
		}
	}
	if _, err := fmt.Fprintf(w, "event: %s\n", event); err != nil {
		return false
	}
	if _, err := fmt.Fprintf(w, "data: %s\n\n", data); err != nil {
		return false
	}
	return w.Flush() == nil
}
