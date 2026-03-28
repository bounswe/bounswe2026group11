package event

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

type discoverEventsFingerprintPayload struct {
	Lat           float64  `json:"lat"`
	Lon           float64  `json:"lon"`
	RadiusMeters  int      `json:"radius_meters"`
	Query         string   `json:"query"`
	PrivacyLevels []string `json:"privacy_levels,omitempty"`
	CategoryIDs   []int    `json:"category_ids,omitempty"`
	StartFrom     *string  `json:"start_from,omitempty"`
	StartTo       *string  `json:"start_to,omitempty"`
	TagNames      []string `json:"tag_names,omitempty"`
	OnlyFavorited bool     `json:"only_favorited"`
}

// buildDiscoverEventsFilterFingerprint hashes the normalized filter set so a
// cursor cannot be reused with a different filter combination.
func buildDiscoverEventsFilterFingerprint(params DiscoverEventsParams) (string, error) {
	payload := discoverEventsFingerprintPayload{
		Lat:           params.Origin.Lat,
		Lon:           params.Origin.Lon,
		RadiusMeters:  params.RadiusMeters,
		Query:         params.Query,
		PrivacyLevels: toPrivacyLevelStrings(params.PrivacyLevels),
		CategoryIDs:   params.CategoryIDs,
		TagNames:      params.TagNames,
		OnlyFavorited: params.OnlyFavorited,
	}
	if params.StartFrom != nil {
		value := params.StartFrom.UTC().Format(timeLayoutCursor)
		payload.StartFrom = &value
	}
	if params.StartTo != nil {
		value := params.StartTo.UTC().Format(timeLayoutCursor)
		payload.StartTo = &value
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal discovery fingerprint: %w", err)
	}

	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:]), nil
}

const timeLayoutCursor = "2006-01-02T15:04:05.999999999Z07:00"

func encodeDiscoverEventsCursor(cursor DiscoverEventsCursor) (string, error) {
	raw, err := json.Marshal(cursor)
	if err != nil {
		return "", fmt.Errorf("marshal discovery cursor: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func decodeDiscoverEventsCursor(token string) (*DiscoverEventsCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return nil, fmt.Errorf("decode discovery cursor: %w", err)
	}

	var cursor DiscoverEventsCursor
	if err := json.Unmarshal(raw, &cursor); err != nil {
		return nil, fmt.Errorf("unmarshal discovery cursor: %w", err)
	}

	if _, ok := domain.ParseEventDiscoverySort(string(cursor.SortBy)); !ok {
		return nil, fmt.Errorf("cursor contains unsupported sort mode")
	}
	if cursor.FilterFingerprint == "" {
		return nil, fmt.Errorf("cursor is missing filter fingerprint")
	}
	if cursor.StartTime.IsZero() {
		return nil, fmt.Errorf("cursor is missing start_time")
	}
	if cursor.EventID == uuid.Nil {
		return nil, fmt.Errorf("cursor is missing event_id")
	}
	if cursor.SortBy == domain.EventDiscoverySortDistance && cursor.DistanceMeters == nil {
		return nil, fmt.Errorf("cursor is missing distance_meters")
	}
	if cursor.SortBy == domain.EventDiscoverySortRelevance {
		if cursor.DistanceMeters == nil {
			return nil, fmt.Errorf("cursor is missing distance_meters")
		}
		if cursor.RelevanceScore == nil {
			return nil, fmt.Errorf("cursor is missing relevance_score")
		}
	}

	return &cursor, nil
}

func buildNextDiscoverEventsCursor(params DiscoverEventsParams, record DiscoverableEventRecord) (DiscoverEventsCursor, error) {
	cursor := DiscoverEventsCursor{
		SortBy:            params.SortBy,
		FilterFingerprint: params.FilterFingerprint,
		StartTime:         record.StartTime.UTC(),
		EventID:           record.ID,
	}

	switch params.SortBy {
	case domain.EventDiscoverySortDistance:
		cursor.DistanceMeters = &record.DistanceMeters
	case domain.EventDiscoverySortRelevance:
		if record.RelevanceScore == nil {
			return DiscoverEventsCursor{}, fmt.Errorf("relevance cursor requires relevance score")
		}
		cursor.DistanceMeters = &record.DistanceMeters
		cursor.RelevanceScore = record.RelevanceScore
	}

	return cursor, nil
}

func toPrivacyLevelStrings(levels []domain.EventPrivacyLevel) []string {
	if len(levels) == 0 {
		return nil
	}

	values := make([]string, len(levels))
	for i, level := range levels {
		values[i] = string(level)
	}
	return values
}
