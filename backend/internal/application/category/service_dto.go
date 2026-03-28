package category

// CategoryItem is the application-level representation of a single category.
type CategoryItem struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// ListCategoriesResult is the output of the ListCategories use case.
type ListCategoriesResult struct {
	Items []CategoryItem `json:"items"`
}
