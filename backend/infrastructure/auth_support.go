package infrastructure

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log"
	"math/big"
	"sync"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type BcryptHasher struct {
	Cost int
}

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

func (h BcryptHasher) Compare(hash, value string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(value))
}

type JWTIssuer struct {
	Secret []byte
	TTL    time.Duration
}

func (j JWTIssuer) IssueAccessToken(user domain.User, issuedAt time.Time) (string, int64, error) {
	expiresAt := issuedAt.Add(j.TTL)
	claims := jwt.MapClaims{
		"sub":      user.ID.String(),
		"username": user.Username,
		"email":    user.Email,
		"iat":      issuedAt.Unix(),
		"exp":      expiresAt.Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(j.Secret)
	if err != nil {
		return "", 0, err
	}

	return signed, int64(j.TTL.Seconds()), nil
}

type OtpCodeGenerator struct{}

func (OtpCodeGenerator) NewCode() string {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "000000"
	}
	return fmt.Sprintf("%06d", n.Int64())
}

type RefreshTokenManager struct {
	ByteLength int
}

func (m RefreshTokenManager) NewToken() (string, string, error) {
	size := m.ByteLength
	if size <= 0 {
		size = 32
	}

	tokenBytes := make([]byte, size)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", "", err
	}

	plain := base64.RawURLEncoding.EncodeToString(tokenBytes)
	return plain, m.HashToken(plain), nil
}

func (m RefreshTokenManager) HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

type MockMailer struct{}

func (MockMailer) SendRegistrationOTP(_ context.Context, email, code string) error {
	log.Printf("mock mailer: registration OTP for %s is %s", email, code)
	return nil
}

type InMemoryRateLimiter struct {
	mu      sync.Mutex
	window  time.Duration
	limit   int
	buckets map[string]bucket
}

type bucket struct {
	WindowStartedAt time.Time
	Count           int
}

func NewInMemoryRateLimiter(limit int, window time.Duration) *InMemoryRateLimiter {
	return &InMemoryRateLimiter{
		window:  window,
		limit:   limit,
		buckets: make(map[string]bucket),
	}
}

func (l *InMemoryRateLimiter) Allow(key string, now time.Time) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	current := l.buckets[key]
	if current.WindowStartedAt.IsZero() || now.Sub(current.WindowStartedAt) >= l.window {
		current = bucket{WindowStartedAt: now, Count: 0}
	}

	if current.Count >= l.limit {
		retryAfter := current.WindowStartedAt.Add(l.window).Sub(now)
		if retryAfter < 0 {
			retryAfter = 0
		}
		l.buckets[key] = current
		return false, retryAfter
	}

	current.Count++
	l.buckets[key] = current
	return true, 0
}
