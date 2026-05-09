//go:build integration

package tests_integration

import (
	"context"
	"testing"

	postgresrepo "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/postgres"
	imageuploadapp "github.com/bounswe/bounswe2026group11/backend/internal/application/imageupload"
	profileapp "github.com/bounswe/bounswe2026group11/backend/internal/application/profile"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/bounswe/bounswe2026group11/backend/tests_integration/common"
	"github.com/google/uuid"
)

func TestGetPublicProfileReturnsPublicSafeProfile(t *testing.T) {
	harness := common.NewEventHarness(t)
	pool := common.RequirePool(t)
	user := common.GivenUser(t, harness.AuthRepo)
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM app_user WHERE id = $1`, user.ID)
	})

	if err := harness.AuthRepo.CreateProfile(context.Background(), user.ID); err != nil {
		t.Fatalf("CreateProfile() error = %v", err)
	}

	displayName := "Public Runner"
	bio := "Long-distance hiker."
	avatarURL := "https://cdn.example/avatar.jpg"
	if err := harness.ProfileService.UpdateMyProfile(context.Background(), profileapp.UpdateProfileInput{
		UserID:      user.ID,
		DisplayName: &displayName,
		Bio:         &bio,
		AvatarURL:   &avatarURL,
	}); err != nil {
		t.Fatalf("UpdateMyProfile() error = %v", err)
	}

	if _, err := harness.ProfileService.CreateMyEquipment(context.Background(), profileapp.CreateEquipmentInput{
		UserID: user.ID,
		Name:   "Trail Poles",
	}); err != nil {
		t.Fatalf("CreateMyEquipment() error = %v", err)
	}

	if _, err := postgresrepo.NewProfileRepository(pool).CreateShowcaseImage(context.Background(), user.ID, "https://cdn.example/showcase.jpg"); err != nil {
		t.Fatalf("CreateShowcaseImage() error = %v", err)
	}

	finalScore := 4.8
	if _, err := pool.Exec(
		context.Background(),
		`INSERT INTO user_score (
			user_id,
			participant_score,
			participant_rating_count,
			hosted_event_score,
			hosted_event_rating_count,
			final_score
		) VALUES ($1, $2, $3, $4, $5, $6)`,
		user.ID,
		4.6,
		7,
		4.9,
		3,
		finalScore,
	); err != nil {
		t.Fatalf("insert user_score error = %v", err)
	}

	result, err := harness.ProfileService.GetPublicProfile(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("GetPublicProfile() error = %v", err)
	}

	if result.UserID != user.ID.String() {
		t.Fatalf("expected user_id %q, got %q", user.ID.String(), result.UserID)
	}
	if result.Username != user.Username {
		t.Fatalf("expected username %q, got %q", user.Username, result.Username)
	}
	if result.DisplayName == nil || *result.DisplayName != displayName {
		t.Fatalf("expected display_name %q, got %+v", displayName, result.DisplayName)
	}
	if result.FinalScore == nil || *result.FinalScore != finalScore {
		t.Fatalf("expected final_score %v, got %+v", finalScore, result.FinalScore)
	}
	if result.HostRatingCount != 3 || result.ParticipantRatingCount != 7 {
		t.Fatalf("unexpected rating counts: host=%d participant=%d", result.HostRatingCount, result.ParticipantRatingCount)
	}
	if len(result.Equipment) != 1 {
		t.Fatalf("expected 1 equipment item, got %d", len(result.Equipment))
	}
	if len(result.ShowcaseImages) != 1 {
		t.Fatalf("expected 1 showcase image, got %d", len(result.ShowcaseImages))
	}
}

func TestGetPublicProfileReturnsNotFoundForUnknownUser(t *testing.T) {
	harness := common.NewEventHarness(t)

	_, err := harness.ProfileService.GetPublicProfile(context.Background(), uuid.New())
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	appErr, ok := err.(*domain.AppError)
	if !ok || appErr.Code != domain.ErrorCodeUserNotFound {
		t.Fatalf("expected user_not_found AppError, got %v", err)
	}
}

func TestMyEquipmentCRUDFlow(t *testing.T) {
	harness := common.NewEventHarness(t)
	pool := common.RequirePool(t)
	user := common.GivenUser(t, harness.AuthRepo)
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM app_user WHERE id = $1`, user.ID)
	})

	if err := harness.AuthRepo.CreateProfile(context.Background(), user.ID); err != nil {
		t.Fatalf("CreateProfile() error = %v", err)
	}

	description := "Waterproof"
	imageURL := "https://cdn.example/jacket.jpg"
	created, err := harness.ProfileService.CreateMyEquipment(context.Background(), profileapp.CreateEquipmentInput{
		UserID:      user.ID,
		Name:        "Jacket",
		Description: &description,
		ImageURL:    &imageURL,
	})
	if err != nil {
		t.Fatalf("CreateMyEquipment() error = %v", err)
	}

	listed, err := harness.ProfileService.ListMyEquipment(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("ListMyEquipment() error = %v", err)
	}
	if len(listed.Items) != 1 {
		t.Fatalf("expected 1 equipment item, got %d", len(listed.Items))
	}

	equipmentID := uuid.MustParse(created.ID)
	updatedDescription := "Waterproof shell"
	updated, err := harness.ProfileService.UpdateMyEquipment(context.Background(), profileapp.UpdateEquipmentInput{
		UserID:      user.ID,
		EquipmentID: equipmentID,
		Description: &updatedDescription,
	})
	if err != nil {
		t.Fatalf("UpdateMyEquipment() error = %v", err)
	}
	if updated.Description == nil || *updated.Description != updatedDescription {
		t.Fatalf("expected updated description %q, got %+v", updatedDescription, updated.Description)
	}

	if err := harness.ProfileService.DeleteMyEquipment(context.Background(), user.ID, equipmentID); err != nil {
		t.Fatalf("DeleteMyEquipment() error = %v", err)
	}

	listed, err = harness.ProfileService.ListMyEquipment(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("ListMyEquipment() error = %v", err)
	}
	if len(listed.Items) != 0 {
		t.Fatalf("expected equipment list to be empty, got %d items", len(listed.Items))
	}
}

func TestMyEquipmentUpdateRejectsForeignOwner(t *testing.T) {
	harness := common.NewEventHarness(t)
	pool := common.RequirePool(t)
	owner := common.GivenUser(t, harness.AuthRepo)
	attacker := common.GivenUser(t, harness.AuthRepo)
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM app_user WHERE id IN ($1, $2)`, owner.ID, attacker.ID)
	})

	if err := harness.AuthRepo.CreateProfile(context.Background(), owner.ID); err != nil {
		t.Fatalf("CreateProfile(owner) error = %v", err)
	}
	if err := harness.AuthRepo.CreateProfile(context.Background(), attacker.ID); err != nil {
		t.Fatalf("CreateProfile(attacker) error = %v", err)
	}

	item, err := harness.ProfileService.CreateMyEquipment(context.Background(), profileapp.CreateEquipmentInput{
		UserID: owner.ID,
		Name:   "Stove",
	})
	if err != nil {
		t.Fatalf("CreateMyEquipment() error = %v", err)
	}

	equipmentID := uuid.MustParse(item.ID)
	newName := "Compromised Stove"
	_, err = harness.ProfileService.UpdateMyEquipment(context.Background(), profileapp.UpdateEquipmentInput{
		UserID:      attacker.ID,
		EquipmentID: equipmentID,
		Name:        &newName,
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	appErr, ok := err.(*domain.AppError)
	if !ok || appErr.Code != domain.ErrorCodeProfileMutationNotAllowed || appErr.Status != domain.StatusForbidden {
		t.Fatalf("expected forbidden profile_mutation_not_allowed, got %v", err)
	}
}

func TestShowcaseImageLifecycleAndOwnership(t *testing.T) {
	harness := common.NewEventHarness(t)
	pool := common.RequirePool(t)
	owner := common.GivenUser(t, harness.AuthRepo)
	attacker := common.GivenUser(t, harness.AuthRepo)
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM app_user WHERE id IN ($1, $2)`, owner.ID, attacker.ID)
	})

	if err := harness.AuthRepo.CreateProfile(context.Background(), owner.ID); err != nil {
		t.Fatalf("CreateProfile(owner) error = %v", err)
	}
	if err := harness.AuthRepo.CreateProfile(context.Background(), attacker.ID); err != nil {
		t.Fatalf("CreateProfile(attacker) error = %v", err)
	}

	service, storage, tokens := newIntegrationImageUploadService(t)
	_, err := service.CreateProfileShowcaseImageUpload(context.Background(), owner.ID)
	if err != nil {
		t.Fatalf("CreateProfileShowcaseImageUpload() error = %v", err)
	}
	storage.existing[tokens.payload.OriginalKey] = true
	storage.existing[tokens.payload.SmallKey] = true

	confirmed, err := service.ConfirmProfileShowcaseImageUpload(
		context.Background(),
		owner.ID,
		imageuploadapp.ConfirmUploadInput{ConfirmToken: "confirm-token"},
	)
	if err != nil {
		t.Fatalf("ConfirmProfileShowcaseImageUpload() error = %v", err)
	}

	showcaseImageID := uuid.MustParse(confirmed.ID)
	publicProfile, err := harness.ProfileService.GetPublicProfile(context.Background(), owner.ID)
	if err != nil {
		t.Fatalf("GetPublicProfile() error = %v", err)
	}
	if len(publicProfile.ShowcaseImages) != 1 {
		t.Fatalf("expected 1 showcase image, got %d", len(publicProfile.ShowcaseImages))
	}

	err = harness.ProfileService.DeleteMyShowcaseImage(context.Background(), attacker.ID, showcaseImageID)
	if err == nil {
		t.Fatal("expected ownership error, got nil")
	}
	appErr, ok := err.(*domain.AppError)
	if !ok || appErr.Code != domain.ErrorCodeProfileMutationNotAllowed || appErr.Status != domain.StatusForbidden {
		t.Fatalf("expected forbidden profile_mutation_not_allowed, got %v", err)
	}

	if err := harness.ProfileService.DeleteMyShowcaseImage(context.Background(), owner.ID, showcaseImageID); err != nil {
		t.Fatalf("DeleteMyShowcaseImage() error = %v", err)
	}

	publicProfile, err = harness.ProfileService.GetPublicProfile(context.Background(), owner.ID)
	if err != nil {
		t.Fatalf("GetPublicProfile() error = %v", err)
	}
	if len(publicProfile.ShowcaseImages) != 0 {
		t.Fatalf("expected showcase images to be empty after delete, got %d", len(publicProfile.ShowcaseImages))
	}
}
