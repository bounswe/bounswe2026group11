package event

import (
	"testing"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

var exactPoint = &domain.GeoPoint{Lat: 41.01234, Lon: 29.98765}

func locationRecord() EventDetailLocationRecord {
	return EventDetailLocationRecord{
		Type:  domain.LocationPoint,
		Point: exactPoint,
	}
}

func TestToEventDetailLocationPublicEventNeverFuzzes(t *testing.T) {
	cases := []struct {
		name   string
		isHost bool
		status *domain.ParticipationStatus
	}{
		{"host", true, nil},
		{"joined participant", false, testParticipationStatus(domain.ParticipationStatusApproved)},
		{"non-participant", false, nil},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			loc := toEventDetailLocation(locationRecord(), domain.PrivacyPublic, tc.isHost, tc.status)
			if loc.IsLocationApproximate {
				t.Error("public event should never set IsLocationApproximate")
			}
			if loc.Point == nil {
				t.Fatal("expected point to be set")
			}
			if loc.Point.Lat != exactPoint.Lat || loc.Point.Lon != exactPoint.Lon {
				t.Errorf("public event coords should be exact: got (%v,%v)", loc.Point.Lat, loc.Point.Lon)
			}
		})
	}
}

func TestToEventDetailLocationProtectedEventFuzzesNonParticipants(t *testing.T) {
	cases := []struct {
		name      string
		isHost    bool
		status    *domain.ParticipationStatus
		wantExact bool
	}{
		{"host gets exact", true, nil, true},
		{"approved gets exact", false, testParticipationStatus(domain.ParticipationStatusApproved), true},
		{"pending reconfirmation gets exact", false, testParticipationStatus(domain.ParticipationStatusPending), true},
		{"none gets approximate", false, nil, false},
		{"leaved gets approximate", false, testParticipationStatus(domain.ParticipationStatusLeaved), false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			loc := toEventDetailLocation(locationRecord(), domain.PrivacyProtected, tc.isHost, tc.status)
			if loc.IsLocationApproximate == tc.wantExact {
				t.Errorf("IsLocationApproximate=%v, want %v", loc.IsLocationApproximate, !tc.wantExact)
			}
			if loc.Point == nil {
				t.Fatal("expected point to be set")
			}
			if tc.wantExact {
				if loc.Point.Lat != exactPoint.Lat || loc.Point.Lon != exactPoint.Lon {
					t.Errorf("expected exact coords (%v,%v), got (%v,%v)",
						exactPoint.Lat, exactPoint.Lon, loc.Point.Lat, loc.Point.Lon)
				}
			} else {
				if loc.Point.Lat == exactPoint.Lat && loc.Point.Lon == exactPoint.Lon {
					t.Error("expected approximate coords but got exact coords")
				}
			}
		})
	}
}

func TestToEventDetailLocationRoutePointsAreFuzzed(t *testing.T) {
	record := EventDetailLocationRecord{
		Type: domain.LocationRoute,
		RoutePoints: []domain.GeoPoint{
			{Lat: 41.01234, Lon: 29.98765},
			{Lat: 41.05678, Lon: 29.94321},
		},
	}

	loc := toEventDetailLocation(record, domain.PrivacyProtected, false, nil)

	if !loc.IsLocationApproximate {
		t.Error("expected IsLocationApproximate for protected non-participant")
	}
	for i, rp := range loc.RoutePoints {
		orig := record.RoutePoints[i]
		if rp.Lat == orig.Lat && rp.Lon == orig.Lon {
			t.Errorf("route point %d not fuzzed", i)
		}
	}
}

func testParticipationStatus(status domain.ParticipationStatus) *domain.ParticipationStatus {
	return &status
}
