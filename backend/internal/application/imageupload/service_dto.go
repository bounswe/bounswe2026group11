package imageupload

import (
	"time"

	"github.com/google/uuid"
)

// Supported upload resource types.
const (
	ResourceProfileAvatar = "PROFILE_AVATAR"
	ResourceEventImage    = "EVENT_IMAGE"

	VariantOriginal = "ORIGINAL"
	VariantSmall    = "SMALL"

	JPEGContentType = "image/jpeg"
)

// CreateUploadResult is returned after presigning upload instructions.
type CreateUploadResult struct {
	BaseURL      string            `json:"base_url"`
	Version      int               `json:"version"`
	ConfirmToken string            `json:"confirm_token"`
	Uploads      []PresignedUpload `json:"uploads"`
}

// PresignedUpload contains all information required for a direct client upload.
type PresignedUpload struct {
	Variant string            `json:"variant"`
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
}

// ConfirmUploadInput is the request body for confirm endpoints.
type ConfirmUploadInput struct {
	ConfirmToken string `json:"confirm_token"`
}

// EventImageState is the event image persistence state used by the service.
type EventImageState struct {
	EventID        uuid.UUID
	HostID         uuid.UUID
	CurrentVersion int
}

// ConfirmTokenPayload is signed into the confirm token and later verified.
type ConfirmTokenPayload struct {
	Resource    string
	OwnerUserID uuid.UUID
	EventID     *uuid.UUID
	Version     int
	UploadID    string
	BaseURL     string
	OriginalKey string
	SmallKey    string
	ExpiresAt   time.Time
}

// PresignedRequest is the storage-port representation of a signed PUT request.
type PresignedRequest struct {
	Method  string
	URL     string
	Headers map[string]string
}

// Settings holds non-secret image upload runtime settings.
type Settings struct {
	PresignTTL      time.Duration
	UploadCacheCtrl string
	CDNBaseURL      string
}
