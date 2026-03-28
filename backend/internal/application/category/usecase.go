package category

import "context"

// UseCase is the inbound application port for category flows.
type UseCase interface {
	ListCategories(ctx context.Context) (*ListCategoriesResult, error)
}
