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
