package notification_handler

import "time"

type registerPushDeviceBody struct {
	FCMToken   *string `json:"fcm_token"`
	Platform   *string `json:"platform"`
	DeviceInfo *string `json:"device_info"`
}

type registerPushDeviceResponse struct {
	InstallationID    string    `json:"installation_id"`
	Platform          string    `json:"platform"`
	ActiveDeviceCount int       `json:"active_device_count"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type notificationResponse struct {
	ID        string            `json:"id"`
	EventID   *string           `json:"event_id"`
	Title     string            `json:"title"`
	Body      string            `json:"body"`
	Type      *string           `json:"type"`
	DeepLink  *string           `json:"deep_link"`
	ImageURL  *string           `json:"image_url"`
	Data      map[string]string `json:"data"`
	IsRead    bool              `json:"is_read"`
	ReadAt    *time.Time        `json:"read_at"`
	CreatedAt time.Time         `json:"created_at"`
}

type listNotificationsResponse struct {
	Items    []notificationResponse `json:"items"`
	PageInfo notificationPageInfo   `json:"page_info"`
}

type notificationPageInfo struct {
	NextCursor *string `json:"next_cursor"`
	HasNext    bool    `json:"has_next"`
}

type unreadCountResponse struct {
	UnreadCount int `json:"unread_count"`
}

type markAllReadResponse struct {
	UpdatedCount int `json:"updated_count"`
}
