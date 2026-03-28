package event

import (
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

const (
	defaultDiscoverRadiusMeters = 10000
	maxDiscoverRadiusMeters     = 50000
	defaultDiscoverLimit        = 20
	maxDiscoverLimit            = 50
)

// normalizeAndValidateDiscoverEventsInput applies defaults, normalizes filters,
// and validates discovery-specific invariants before the repository is called.
func normalizeAndValidateDiscoverEventsInput(input DiscoverEventsInput) (DiscoverEventsParams, map[string]string) {
	errs := make(map[string]string)
	params := DiscoverEventsParams{
		OnlyFavorited: input.OnlyFavorited,
	}

	if input.Lat == nil {
		errs["lat"] = "lat is required"
	} else if *input.Lat < -90 || *input.Lat > 90 {
		errs["lat"] = "lat must be between -90 and 90"
	} else {
		params.Origin.Lat = *input.Lat
	}

	if input.Lon == nil {
		errs["lon"] = "lon is required"
	} else if *input.Lon < -180 || *input.Lon > 180 {
		errs["lon"] = "lon must be between -180 and 180"
	} else {
		params.Origin.Lon = *input.Lon
	}

	params.RadiusMeters = defaultDiscoverRadiusMeters
	if input.RadiusMeters != nil {
		params.RadiusMeters = *input.RadiusMeters
	}
	if params.RadiusMeters <= 0 || params.RadiusMeters > maxDiscoverRadiusMeters {
		errs["radius_meters"] = "radius_meters must be between 1 and 50000"
	}

	params.Limit = defaultDiscoverLimit
	if input.Limit != nil {
		params.Limit = *input.Limit
	}
	if params.Limit <= 0 || params.Limit > maxDiscoverLimit {
		errs["limit"] = "limit must be between 1 and 50"
	}

	if input.Query != nil {
		params.Query = strings.TrimSpace(*input.Query)
	}
	if params.Query != "" {
		params.SearchTSQuery = buildPrefixTSQuery(params.Query)
		if params.SearchTSQuery == "" {
			errs["q"] = "q must contain at least one letter or number"
		}
	}

	privacyLevels, privacyErr := normalizePrivacyLevels(input.PrivacyLevels)
	if privacyErr != "" {
		errs["privacy_levels"] = privacyErr
	} else {
		params.PrivacyLevels = privacyLevels
	}

	categoryIDs, categoryErr := normalizeCategoryIDs(input.CategoryIDs)
	if categoryErr != "" {
		errs["category_ids"] = categoryErr
	} else {
		params.CategoryIDs = categoryIDs
	}

	tagNames, tagErr := normalizeTagNames(input.TagNames)
	if tagErr != "" {
		errs["tag_names"] = tagErr
	} else {
		params.TagNames = tagNames
	}

	params.StartFrom = normalizeTime(input.StartFrom)
	params.StartTo = normalizeTime(input.StartTo)
	if params.StartFrom != nil && params.StartTo != nil && params.StartFrom.After(*params.StartTo) {
		errs["start_from"] = "start_from must be before or equal to start_to"
	}

	if input.SortBy != nil {
		params.SortBy = *input.SortBy
	} else if params.Query != "" {
		params.SortBy = domain.EventDiscoverySortRelevance
	} else {
		params.SortBy = domain.EventDiscoverySortStartTime
	}
	if _, ok := domain.ParseEventDiscoverySort(string(params.SortBy)); !ok {
		errs["sort_by"] = "must be one of: START_TIME, DISTANCE, RELEVANCE"
	}
	if params.SortBy == domain.EventDiscoverySortRelevance && params.Query == "" {
		errs["sort_by"] = "sort_by=RELEVANCE requires q"
	}

	if input.Cursor != nil {
		params.CursorToken = strings.TrimSpace(*input.Cursor)
	}

	return params, errs
}

func normalizePrivacyLevels(levels []domain.EventPrivacyLevel) ([]domain.EventPrivacyLevel, string) {
	if len(levels) == 0 {
		return []domain.EventPrivacyLevel{
			domain.PrivacyPublic,
			domain.PrivacyProtected,
		}, ""
	}

	seen := make(map[domain.EventPrivacyLevel]struct{}, len(levels))
	normalized := make([]domain.EventPrivacyLevel, 0, len(levels))
	for _, level := range levels {
		if level != domain.PrivacyPublic && level != domain.PrivacyProtected {
			return nil, "privacy_levels may only include PUBLIC or PROTECTED"
		}
		if _, ok := seen[level]; ok {
			continue
		}
		seen[level] = struct{}{}
		normalized = append(normalized, level)
	}

	sort.Slice(normalized, func(i, j int) bool {
		return normalized[i] < normalized[j]
	})

	return normalized, ""
}

func normalizeCategoryIDs(categoryIDs []int) ([]int, string) {
	if len(categoryIDs) == 0 {
		return nil, ""
	}

	seen := make(map[int]struct{}, len(categoryIDs))
	normalized := make([]int, 0, len(categoryIDs))
	for _, categoryID := range categoryIDs {
		if categoryID <= 0 {
			return nil, "category_ids must contain only positive integers"
		}
		if _, ok := seen[categoryID]; ok {
			continue
		}
		seen[categoryID] = struct{}{}
		normalized = append(normalized, categoryID)
	}

	sort.Ints(normalized)
	return normalized, ""
}

func normalizeTagNames(tagNames []string) ([]string, string) {
	if len(tagNames) == 0 {
		return nil, ""
	}

	seen := make(map[string]struct{}, len(tagNames))
	normalized := make([]string, 0, len(tagNames))
	for _, tagName := range tagNames {
		trimmed := strings.TrimSpace(tagName)
		if trimmed == "" {
			return nil, "tag_names must not contain empty values"
		}

		lower := strings.ToLower(trimmed)
		if _, ok := seen[lower]; ok {
			continue
		}
		seen[lower] = struct{}{}
		normalized = append(normalized, lower)
	}

	sort.Strings(normalized)
	return normalized, ""
}

func normalizeTime(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}

	utc := value.UTC()
	return &utc
}

func buildPrefixTSQuery(query string) string {
	tokens := strings.FieldsFunc(strings.ToLower(query), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	})
	if len(tokens) == 0 {
		return ""
	}

	prefixed := make([]string, 0, len(tokens))
	for _, token := range tokens {
		if token == "" {
			continue
		}
		prefixed = append(prefixed, token+":*")
	}

	return strings.Join(prefixed, " & ")
}
