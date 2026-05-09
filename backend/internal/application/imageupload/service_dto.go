package imageupload

import (
	"time"

	"github.com/google/uuid"
)

// Supported upload resource types.
const (
	ResourceProfileAvatar    = "PROFILE_AVATAR"
	ResourceProfileShowcase  = "PROFILE_SHOWCASE_IMAGE"
	ResourceEventImage       = "EVENT_IMAGE"
	ResourceEventReviewImage = "EVENT_REVIEW_IMAGE"
	ResourceJoinRequestImage = "EVENT_JOIN_REQUEST_IMAGE"
	ResourceEventReportImage = "EVENT_REPORT_IMAGE"

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

// ConfirmReviewImageResult exposes the uploaded review image URL after token
// and object validation.
type ConfirmReviewImageResult struct {
	BaseURL string `json:"base_url"`
}

// ConfirmJoinRequestImageResult exposes the uploaded join-request image URL
// after token and object validation.
type ConfirmJoinRequestImageResult struct {
	BaseURL string `json:"base_url"`
}

// ConfirmShowcaseImageResult exposes the persisted showcase image after token
// and object validation.
type ConfirmShowcaseImageResult struct {
	ID       string `json:"id"`
	ImageURL string `json:"image_url"`
}

// ConfirmReportImageResult exposes the uploaded report image URL after token
// and object validation.
type ConfirmReportImageResult struct {
	BaseURL string `json:"base_url"`
}

// EventImageState is the event image persistence state used by the service.
type EventImageState struct {
	EventID        uuid.UUID
	HostID         uuid.UUID
	CurrentVersion int
}

// EventReviewImageState is the event state used to authorize review image uploads.
type EventReviewImageState struct {
	EventID                 uuid.UUID
	HostID                  uuid.UUID
	Status                  string
	PrivacyLevel            string
	IsQualifyingParticipant bool
}

// EventJoinRequestImageState is the event state used to authorize join-request image uploads.
type EventJoinRequestImageState struct {
	EventID      uuid.UUID
	HostID       uuid.UUID
	Status       string
	PrivacyLevel string
}

// EventReportImageState is the event state used to authorize report image uploads.
type EventReportImageState struct {
	EventID uuid.UUID
	Status  string
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
