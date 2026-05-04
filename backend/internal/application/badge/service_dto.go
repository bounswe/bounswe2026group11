package badge

// ParticipationStatsRecord aggregates the participant-side metrics consumed
// by participation badge rules.
type ParticipationStatsRecord struct {
	CompletedEventCount     int
	DistinctCategoriesCount int
}

// HostStatsRecord aggregates the host-side metrics consumed by hosting badge
// rules.
type HostStatsRecord struct {
	CompletedHostedEventCount int
	HostScore                 *float64
	HostRatingCount           int
}

// BadgeItem is the wire representation of a badge definition.
type BadgeItem struct {
	Slug        string  `json:"slug"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	IconURL     *string `json:"icon_url"`
	Category    string  `json:"category"`
}

// EarnedBadgeItem extends BadgeItem with the time when the viewer earned it.
type EarnedBadgeItem struct {
	BadgeItem
	EarnedAt string `json:"earned_at"`
}

// ListUserBadgesResult is the output shape of ListMyBadges and ListUserBadges.
type ListUserBadgesResult struct {
	Items []EarnedBadgeItem `json:"items"`
}

// CatalogBadgeItem is BadgeItem with viewer-specific earned status fields.
type CatalogBadgeItem struct {
	BadgeItem
	Earned   bool    `json:"earned"`
	EarnedAt *string `json:"earned_at"`
}

// ListBadgesResult is the output of the catalog endpoint.
type ListBadgesResult struct {
	Items []CatalogBadgeItem `json:"items"`
}
