package admin

// Service implements read-only admin backoffice use cases.
type Service struct {
	repo Repository
}

var _ UseCase = (*Service)(nil)

// NewService constructs an admin service with the given repository.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}
