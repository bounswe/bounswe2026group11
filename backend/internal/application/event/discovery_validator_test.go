package event

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func baseDiscoverInput() DiscoverEventsInput {
	lat := 41.0
	lon := 29.0
	return DiscoverEventsInput{Lat: &lat, Lon: &lon}
}

func TestNormalizeDiscoverEventsInput_ChildFriendlyTrue(t *testing.T) {
	input := baseDiscoverInput()
	input.OnlyChildFriendly = true

	params, errs := normalizeAndValidateDiscoverEventsInput(input)

	require.Empty(t, errs)
	assert.True(t, params.OnlyChildFriendly)
	assert.False(t, params.OnlyFamilyOriented)
}

func TestNormalizeDiscoverEventsInput_FamilyOrientedTrue(t *testing.T) {
	input := baseDiscoverInput()
	input.OnlyFamilyOriented = true

	params, errs := normalizeAndValidateDiscoverEventsInput(input)

	require.Empty(t, errs)
	assert.False(t, params.OnlyChildFriendly)
	assert.True(t, params.OnlyFamilyOriented)
}

func TestNormalizeDiscoverEventsInput_BothAudienceFilters(t *testing.T) {
	input := baseDiscoverInput()
	input.OnlyChildFriendly = true
	input.OnlyFamilyOriented = true

	params, errs := normalizeAndValidateDiscoverEventsInput(input)

	require.Empty(t, errs)
	assert.True(t, params.OnlyChildFriendly)
	assert.True(t, params.OnlyFamilyOriented)
}

func TestNormalizeDiscoverEventsInput_NoAudienceFilters(t *testing.T) {
	input := baseDiscoverInput()

	params, errs := normalizeAndValidateDiscoverEventsInput(input)

	require.Empty(t, errs)
	assert.False(t, params.OnlyChildFriendly)
	assert.False(t, params.OnlyFamilyOriented)
}
