package ratelimit

import (
	"sync"
	"time"
)

// InMemoryRateLimiter implements auth.RateLimiter using a fixed-window
// counter stored in memory. Swap with a Redis-backed implementation for
// distributed deployments.
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

// NewInMemoryRateLimiter creates a rate limiter with the given max requests (limit)
// per time window.
func NewInMemoryRateLimiter(limit int, window time.Duration) *InMemoryRateLimiter {
	return &InMemoryRateLimiter{
		window:  window,
		limit:   limit,
		buckets: make(map[string]bucket),
	}
}

// Allow checks whether key is within its rate limit at time now. Returns false
// and a suggested retry-after duration if the limit has been reached.
func (l *InMemoryRateLimiter) Allow(key string, now time.Time) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	current := l.buckets[key]

	// Start a new window if this is the first request or the previous window has elapsed.
	if current.WindowStartedAt.IsZero() || now.Sub(current.WindowStartedAt) >= l.window {
		current = bucket{WindowStartedAt: now, Count: 0}
	}

	// Reject if the request count has reached the limit within this window.
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
