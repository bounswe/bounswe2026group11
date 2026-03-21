package hasher

import "golang.org/x/crypto/bcrypt"

// BcryptHasher implements domain.PasswordHasher using bcrypt.
type BcryptHasher struct {
	Cost int
}

// Hash returns a bcrypt hash of value, using the configured cost or bcrypt.DefaultCost.
func (h BcryptHasher) Hash(value string) (string, error) {
	cost := h.Cost
	if cost == 0 {
		cost = bcrypt.DefaultCost
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(value), cost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// Compare returns nil if hash is a valid bcrypt hash of value, or an error otherwise.
func (h BcryptHasher) Compare(hash, value string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(value))
}
