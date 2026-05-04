package domain

import (
	"time"

	"github.com/google/uuid"
)

// BadgeCategory groups badges by the kind of activity they reward.
type BadgeCategory string

const (
	BadgeCategoryHosting       BadgeCategory = "HOSTING"
	BadgeCategoryParticipation BadgeCategory = "PARTICIPATION"
	BadgeCategorySocial        BadgeCategory = "SOCIAL"
)

func (c BadgeCategory) String() string { return string(c) }

// BadgeSlug is the stable, machine-friendly identifier of a badge definition.
// Slugs are seeded in migration 000026 and must stay UPPERCASE.
type BadgeSlug string

const (
	BadgeSlugFirstSteps     BadgeSlug = "FIRST_STEPS"
	BadgeSlugRegular        BadgeSlug = "REGULAR"
	BadgeSlugVeteran        BadgeSlug = "VETERAN"
	BadgeSlugExplorer       BadgeSlug = "EXPLORER"
	BadgeSlugHostDebut      BadgeSlug = "HOST_DEBUT"
	BadgeSlugSuperHost      BadgeSlug = "SUPER_HOST"
	BadgeSlugTopRated       BadgeSlug = "TOP_RATED"
	BadgeSlugFavoriteFinder BadgeSlug = "FAVORITE_FINDER"
)

func (s BadgeSlug) String() string { return string(s) }

// Badge is the catalog definition of a badge that users can earn.
type Badge struct {
	ID          int16
	Slug        BadgeSlug
	Name        string
	Description string
	IconURL     *string
	Category    BadgeCategory
	SortOrder   int16
}

// UserBadge represents one badge earned by a user.
type UserBadge struct {
	UserID     uuid.UUID
	BadgeID    int16
	Slug       BadgeSlug
	EarnedAt   time.Time
	Definition Badge
}
