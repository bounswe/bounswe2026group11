package domain_test

import (
	"math"
	"testing"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

func TestApproximateGeoPointSnapsToGrid(t *testing.T) {
	cases := []struct {
		name     string
		input    domain.GeoPoint
		wantLat  float64
		wantLon  float64
	}{
		{
			name:    "exact grid point unchanged",
			input:   domain.GeoPoint{Lat: 41.0, Lon: 29.0},
			wantLat: 41.0,
			wantLon: 29.0,
		},
		{
			name:    "rounds to nearest 0.005",
			input:   domain.GeoPoint{Lat: 41.0024, Lon: 28.9974},
			wantLat: 41.0,
			wantLon: 28.995,
		},
		{
			name:    "rounds up when past midpoint",
			input:   domain.GeoPoint{Lat: 41.0026, Lon: 29.0026},
			wantLat: 41.005,
			wantLon: 29.005,
		},
		{
			name:    "negative coordinates round correctly",
			input:   domain.GeoPoint{Lat: -33.8688, Lon: 151.2093},
			wantLat: math.Round(-33.8688/0.005) * 0.005,
			wantLon: math.Round(151.2093/0.005) * 0.005,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := domain.ApproximateGeoPoint(tc.input)
			if math.Abs(got.Lat-tc.wantLat) > 1e-9 {
				t.Errorf("Lat: got %v, want %v", got.Lat, tc.wantLat)
			}
			if math.Abs(got.Lon-tc.wantLon) > 1e-9 {
				t.Errorf("Lon: got %v, want %v", got.Lon, tc.wantLon)
			}
		})
	}
}

func TestApproximateGeoPointReducesPrecision(t *testing.T) {
	original := domain.GeoPoint{Lat: 41.01234567, Lon: 29.98765432}
	approx := domain.ApproximateGeoPoint(original)

	const maxDelta = 0.005
	if math.Abs(approx.Lat-original.Lat) > maxDelta {
		t.Errorf("approximate lat moved more than grid size: delta %v", math.Abs(approx.Lat-original.Lat))
	}
	if math.Abs(approx.Lon-original.Lon) > maxDelta {
		t.Errorf("approximate lon moved more than grid size: delta %v", math.Abs(approx.Lon-original.Lon))
	}
	if approx.Lat == original.Lat && approx.Lon == original.Lon {
		t.Error("expected coordinates to be snapped, but they were unchanged")
	}
}
