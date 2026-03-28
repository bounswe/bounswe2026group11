package category

import "context"

// Service owns category-specific application behavior.
type Service struct {
	repo Repository
}

var _ UseCase = (*Service)(nil)

// NewService constructs a category service backed by its own repository.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// ListCategories returns all event categories ordered by id.
func (s *Service) ListCategories(ctx context.Context) (*ListCategoriesResult, error) {
	categories, err := s.repo.ListCategories(ctx)
	if err != nil {
		return nil, err
	}

	items := make([]CategoryItem, len(categories))
	for i, c := range categories {
		items[i] = CategoryItem{ID: c.ID, Name: c.Name}
	}

	return &ListCategoriesResult{Items: items}, nil
}
