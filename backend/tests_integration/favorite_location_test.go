//go:build integration

package tests_integration

import (
	"context"
	"testing"

	favoritelocationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/favorite_location"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/bounswe/bounswe2026group11/backend/tests_integration/common"
	"github.com/google/uuid"
)

func TestFavoriteLocationCRUDOrdersAlphabetically(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewFavoriteLocationHarness(t)
	user := common.GivenUser(t, harness.AuthRepo)

	first, err := harness.Service.CreateMyFavoriteLocation(context.Background(), favoritelocationapp.CreateFavoriteLocationInput{
		UserID:  user.ID,
		Name:    "Charlie",
		Address: "Address C",
		Lat:     41.1000,
		Lon:     29.1000,
	})
	if err != nil {
		t.Fatalf("CreateMyFavoriteLocation(first) error = %v", err)
	}
	second, err := harness.Service.CreateMyFavoriteLocation(context.Background(), favoritelocationapp.CreateFavoriteLocationInput{
		UserID:  user.ID,
		Name:    "Alpha",
		Address: "Address A",
		Lat:     41.2000,
		Lon:     29.2000,
	})
	if err != nil {
		t.Fatalf("CreateMyFavoriteLocation(second) error = %v", err)
	}

	// when
	list, err := harness.Service.ListMyFavoriteLocations(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("ListMyFavoriteLocations() error = %v", err)
	}

	// then
	if len(list.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(list.Items))
	}
	if list.Items[0].ID != second.ID || list.Items[0].Name != "Alpha" {
		t.Fatalf("expected first item to be Alpha (%s), got %#v", second.ID, list.Items[0])
	}
	if list.Items[1].ID != first.ID || list.Items[1].Name != "Charlie" {
		t.Fatalf("expected second item to be Charlie (%s), got %#v", first.ID, list.Items[1])
	}

	updatedAddress := "Updated Address C"
	updatedLat := 41.3000
	if _, err := harness.Service.UpdateMyFavoriteLocation(context.Background(), favoritelocationapp.UpdateFavoriteLocationInput{
		UserID:             user.ID,
		FavoriteLocationID: mustParseUUID(t, first.ID),
		Address:            &updatedAddress,
		Lat:                &updatedLat,
	}); err != nil {
		t.Fatalf("UpdateMyFavoriteLocation() error = %v", err)
	}

	list, err = harness.Service.ListMyFavoriteLocations(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("ListMyFavoriteLocations(after update) error = %v", err)
	}
	if list.Items[1].Address != updatedAddress || list.Items[1].Lat != updatedLat || list.Items[1].Lon != 29.1000 {
		t.Fatalf("expected updated item to preserve lon and change address/lat, got %#v", list.Items[1])
	}

	if err := harness.Service.DeleteMyFavoriteLocation(context.Background(), user.ID, mustParseUUID(t, second.ID)); err != nil {
		t.Fatalf("DeleteMyFavoriteLocation() error = %v", err)
	}

	list, err = harness.Service.ListMyFavoriteLocations(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("ListMyFavoriteLocations(after delete) error = %v", err)
	}
	if len(list.Items) != 1 || list.Items[0].ID != first.ID {
		t.Fatalf("expected only %s to remain, got %#v", first.ID, list.Items)
	}
}

func TestFavoriteLocationCreateRejectsFourthLocation(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewFavoriteLocationHarness(t)
	user := common.GivenUser(t, harness.AuthRepo)

	for _, location := range []favoritelocationapp.CreateFavoriteLocationInput{
		{UserID: user.ID, Name: "Home", Address: "Address 1", Lat: 41.01, Lon: 29.01},
		{UserID: user.ID, Name: "Work", Address: "Address 2", Lat: 41.02, Lon: 29.02},
		{UserID: user.ID, Name: "Gym", Address: "Address 3", Lat: 41.03, Lon: 29.03},
	} {
		if _, err := harness.Service.CreateMyFavoriteLocation(context.Background(), location); err != nil {
			t.Fatalf("CreateMyFavoriteLocation(seed %q) error = %v", location.Name, err)
		}
	}

	// when
	_, err := harness.Service.CreateMyFavoriteLocation(context.Background(), favoritelocationapp.CreateFavoriteLocationInput{
		UserID:  user.ID,
		Name:    "Cafe",
		Address: "Address 4",
		Lat:     41.04,
		Lon:     29.04,
	})

	// then
	common.RequireAppErrorCode(t, err, domain.ErrorCodeFavoriteLocationLimitExceeded)

	list, listErr := harness.Service.ListMyFavoriteLocations(context.Background(), user.ID)
	if listErr != nil {
		t.Fatalf("ListMyFavoriteLocations() error = %v", listErr)
	}
	if len(list.Items) != favoritelocationapp.MaxFavoriteLocations {
		t.Fatalf("expected %d items after rejected create, got %d", favoritelocationapp.MaxFavoriteLocations, len(list.Items))
	}
}

func TestFavoriteLocationOwnershipPreventsCrossUserMutation(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewFavoriteLocationHarness(t)
	owner := common.GivenUser(t, harness.AuthRepo)
	otherUser := common.GivenUser(t, harness.AuthRepo)
	location, err := harness.Service.CreateMyFavoriteLocation(context.Background(), favoritelocationapp.CreateFavoriteLocationInput{
		UserID:  owner.ID,
		Name:    "Home",
		Address: "Owner Address",
		Lat:     41.0082,
		Lon:     28.9784,
	})
	if err != nil {
		t.Fatalf("CreateMyFavoriteLocation() error = %v", err)
	}

	updatedName := "Compromised"

	// when
	_, updateErr := harness.Service.UpdateMyFavoriteLocation(context.Background(), favoritelocationapp.UpdateFavoriteLocationInput{
		UserID:             otherUser.ID,
		FavoriteLocationID: mustParseUUID(t, location.ID),
		Name:               &updatedName,
	})
	deleteErr := harness.Service.DeleteMyFavoriteLocation(context.Background(), otherUser.ID, mustParseUUID(t, location.ID))

	// then
	common.RequireAppErrorCode(t, updateErr, domain.ErrorCodeFavoriteLocationNotFound)
	common.RequireAppErrorCode(t, deleteErr, domain.ErrorCodeFavoriteLocationNotFound)

	list, err := harness.Service.ListMyFavoriteLocations(context.Background(), owner.ID)
	if err != nil {
		t.Fatalf("ListMyFavoriteLocations(owner) error = %v", err)
	}
	if len(list.Items) != 1 || list.Items[0].Name != "Home" {
		t.Fatalf("expected owner's location to remain unchanged, got %#v", list.Items)
	}

	otherList, err := harness.Service.ListMyFavoriteLocations(context.Background(), otherUser.ID)
	if err != nil {
		t.Fatalf("ListMyFavoriteLocations(other user) error = %v", err)
	}
	if len(otherList.Items) != 0 {
		t.Fatalf("expected other user to have no locations, got %#v", otherList.Items)
	}
}

func mustParseUUID(t *testing.T, value string) uuid.UUID {
	t.Helper()

	parsed, err := uuid.Parse(value)
	if err != nil {
		t.Fatalf("uuid.Parse(%q) error = %v", value, err)
	}

	return parsed
}
