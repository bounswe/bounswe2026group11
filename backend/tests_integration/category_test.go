//go:build integration

package tests_integration

import (
	"context"
	"testing"

	postgresrepo "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/postgres"
	categoryapp "github.com/bounswe/bounswe2026group11/backend/internal/application/category"
	"github.com/bounswe/bounswe2026group11/backend/tests_integration/common"
)

func TestListCategoriesReturnsSeedData(t *testing.T) {
	t.Parallel()

	// given
	pool := common.RequirePool(t)
	repo := postgresrepo.NewCategoryRepository(pool)
	service := categoryapp.NewService(repo)

	// when
	result, err := service.ListCategories(context.Background())

	// then
	if err != nil {
		t.Fatalf("ListCategories() error = %v", err)
	}
	if len(result.Items) < 20 {
		t.Fatalf("expected at least 20 seeded categories, got %d", len(result.Items))
	}

	// verify ordering is ascending by id
	for i := 1; i < len(result.Items); i++ {
		if result.Items[i].ID <= result.Items[i-1].ID {
			t.Fatalf("categories are not ordered by id asc: item[%d].ID=%d <= item[%d].ID=%d",
				i, result.Items[i].ID, i-1, result.Items[i-1].ID)
		}
	}

	// verify each item has a non-empty name
	for _, item := range result.Items {
		if item.Name == "" {
			t.Fatalf("category id=%d has empty name", item.ID)
		}
	}
}

func TestListCategoriesResponseShape(t *testing.T) {
	t.Parallel()

	// given
	pool := common.RequirePool(t)
	repo := postgresrepo.NewCategoryRepository(pool)
	service := categoryapp.NewService(repo)

	// when
	result, err := service.ListCategories(context.Background())

	// then
	if err != nil {
		t.Fatalf("ListCategories() error = %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.Items == nil {
		t.Fatal("expected non-nil items slice")
	}
	for _, item := range result.Items {
		if item.ID <= 0 {
			t.Fatalf("expected positive category id, got %d", item.ID)
		}
	}
}
