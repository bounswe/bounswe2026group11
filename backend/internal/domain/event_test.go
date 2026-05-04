package domain_test

import (
	"math"
	"testing"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

// haversineMeters returns the great-circle distance in metres between two points.
func haversineMeters(a, b domain.GeoPoint) float64 {
	const earthRadius = 6371000.0
	lat1 := a.Lat * math.Pi / 180
	lat2 := b.Lat * math.Pi / 180
	dLat := (b.Lat - a.Lat) * math.Pi / 180
	dLon := (b.Lon - a.Lon) * math.Pi / 180
	h := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1)*math.Cos(lat2)*math.Sin(dLon/2)*math.Sin(dLon/2)
	return earthRadius * 2 * math.Atan2(math.Sqrt(h), math.Sqrt(1-h))
}

func TestApproximateGeoPointStaysWithin250m(t *testing.T) {
	origins := []domain.GeoPoint{
		{Lat: 41.01234, Lon: 29.98765}, // Istanbul
		{Lat: 51.50736, Lon: -0.12776}, // London
		{Lat: -33.8688, Lon: 151.2093}, // Sydney
		{Lat: 0.0, Lon: 0.0},           // equator/prime meridian
	}

	const iterations = 500
	for _, origin := range origins {
		for i := 0; i < iterations; i++ {
			approx := domain.ApproximateGeoPoint(origin)
			dist := haversineMeters(origin, approx)
			if dist > 250.0 {
				t.Errorf("offset %.1f m exceeds 250 m radius for origin (%v,%v)",
					dist, origin.Lat, origin.Lon)
			}
		}
	}
}

func TestApproximateGeoPointProducesVariedResults(t *testing.T) {
	origin := domain.GeoPoint{Lat: 41.01234, Lon: 29.98765}
	seen := make(map[[2]float64]bool)
	for i := 0; i < 20; i++ {
		p := domain.ApproximateGeoPoint(origin)
		seen[[2]float64{p.Lat, p.Lon}] = true
	}
	if len(seen) < 10 {
		t.Errorf("expected varied offsets across calls, got only %d distinct points in 20 calls", len(seen))
	}
}
