package otp

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

// CodeGenerator implements domain.OTPCodeGenerator.
type CodeGenerator struct{}

// NewCode generates a cryptographically random 6-digit OTP string.
func (CodeGenerator) NewCode() string {
	maxValue := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, maxValue)
	if err != nil {
		// Fallback to a fixed code if the CSPRNG fails; should never happen in practice.
		return "000000"
	}
	return fmt.Sprintf("%06d", n.Int64())
}
