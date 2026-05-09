import { useEffect, useMemo } from 'react';
import {
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps';
import { useTheme } from '@/contexts/ThemeContext';
import {
  GOOGLE_MAPS_MAP_ID,
  isGoogleMapsConfigured,
} from '@/components/GoogleMapsProvider';
import type { EventDetailLocation } from '@/models/event';
import { APPROXIMATE_LOCATION_RADIUS_METERS } from '@/utils/locationApproximation';

interface EventDetailMiniMapProps {
  location: EventDetailLocation;
}

interface LatLng {
  lat: number;
  lng: number;
}

function ApproximateAreaCircle({
  center,
}: {
  center: LatLng;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const circle = new google.maps.Circle({
      map,
      center,
      radius: APPROXIMATE_LOCATION_RADIUS_METERS,
      strokeColor: '#2563eb',
      strokeOpacity: 1,
      strokeWeight: 2,
      fillColor: '#60a5fa',
      fillOpacity: 0.22,
      clickable: false,
    });
    return () => {
      circle.setMap(null);
    };
  }, [center, map]);
  return null;
}

function RoutePolyline({ path }: { path: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || path.length < 2) return;
    const polyline = new google.maps.Polyline({
      map,
      path,
      strokeColor: '#7c3aed',
      strokeOpacity: 1,
      strokeWeight: 4,
      clickable: false,
    });
    return () => {
      polyline.setMap(null);
    };
  }, [map, path]);
  return null;
}

export default function EventDetailMiniMap({ location }: EventDetailMiniMapProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const anchor = useMemo<LatLng | null>(() => {
    if (location.type === 'POINT' && location.point) {
      return { lat: location.point.lat, lng: location.point.lon };
    }
    if (location.type === 'ROUTE' && location.route_points.length > 0) {
      const first = location.route_points[0];
      return { lat: first.lat, lng: first.lon };
    }
    return null;
  }, [location]);

  const routePath = useMemo<LatLng[]>(() => {
    if (location.type !== 'ROUTE') return [];
    return location.route_points.map((p) => ({ lat: p.lat, lng: p.lon }));
  }, [location]);

  if (!anchor) return null;

  if (!isGoogleMapsConfigured()) {
    return (
      <div className="ed-map-surface ed-map-surface--placeholder" role="status">
        <p>Map preview is unavailable. Configure VITE_GOOGLE_MAPS_API_KEY to view this location.</p>
      </div>
    );
  }

  return (
    <GoogleMap
      key={isDark ? 'dark' : 'light'}
      mapId={GOOGLE_MAPS_MAP_ID}
      defaultCenter={anchor}
      defaultZoom={14}
      colorScheme={isDark ? 'DARK' : 'LIGHT'}
      gestureHandling="cooperative"
      disableDefaultUI={false}
      mapTypeControl={false}
      streetViewControl={false}
      fullscreenControl={false}
      clickableIcons={false}
      className="ed-map-surface"
    >
      {location.is_location_approximate ? (
        <ApproximateAreaCircle center={anchor} />
      ) : (
        <AdvancedMarker position={anchor}>
          <Pin background="#2563eb" borderColor="#1d4ed8" glyphColor="#ffffff" />
        </AdvancedMarker>
      )}
      {!location.is_location_approximate && routePath.length > 1 && (
        <RoutePolyline path={routePath} />
      )}
    </GoogleMap>
  );
}
