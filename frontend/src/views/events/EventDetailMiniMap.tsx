import { useEffect, useMemo, useState } from 'react';
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
import { fetchRoutedGeometry } from '@/services/eventService';

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

function FitRouteBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || points.length < 2) return;
    const bounds = new google.maps.LatLngBounds();
    for (const p of points) {
      bounds.extend(p);
    }
    map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
  }, [map, points]);
  return null;
}

export default function EventDetailMiniMap({ location }: EventDetailMiniMapProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [routedPath, setRoutedPath] = useState<LatLng[] | null>(null);

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

  const routeWaypoints = useMemo<LatLng[]>(() => {
    if (location.type !== 'ROUTE') return [];
    return location.route_points.map((p) => ({ lat: p.lat, lng: p.lon }));
  }, [location]);

  const straightPath = useMemo<LatLng[]>(() => {
    if (location.type !== 'ROUTE') return [];
    return location.route_points.map((p) => ({ lat: p.lat, lng: p.lon }));
  }, [location]);

  useEffect(() => {
    if (location.type !== 'ROUTE' || location.route_points.length < 2) {
      setRoutedPath(null);
      return;
    }
    let cancelled = false;
    fetchRoutedGeometry(location.route_points).then((geom) => {
      if (cancelled) return;
      if (geom && geom.length >= 2) {
        setRoutedPath(geom.map((p) => ({ lat: p.lat, lng: p.lon })));
      }
    });
    return () => { cancelled = true; };
  }, [location]);

  if (!anchor) return null;

  if (!isGoogleMapsConfigured()) {
    return (
      <div className="ed-map-surface ed-map-surface--placeholder" role="status">
        <p>Map preview is unavailable. Configure VITE_GOOGLE_MAPS_WEB_API_KEY to view this location.</p>
      </div>
    );
  }

  const isRoute = location.type === 'ROUTE' && routeWaypoints.length >= 2;
  const displayPath = routedPath ?? straightPath;

  return (
    <GoogleMap
      key={isDark ? 'dark' : 'light'}
      mapId={GOOGLE_MAPS_MAP_ID}
      defaultCenter={anchor}
      defaultZoom={isRoute ? 12 : 14}
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
      ) : isRoute ? (
        <>
          <FitRouteBounds points={routeWaypoints} />
          <RoutePolyline path={displayPath} />
          {routeWaypoints.map((point, index) => {
            const isFirst = index === 0;
            const isLast = index === routeWaypoints.length - 1;
            return (
              <AdvancedMarker key={index} position={point}>
                <div className="ed-route-marker">
                  <div
                    className={`ed-route-marker-dot ${isFirst ? 'ed-route-marker-dot--start' : ''} ${isLast ? 'ed-route-marker-dot--end' : ''}`}
                  >
                    <span className="ed-route-marker-number">{index + 1}</span>
                  </div>
                </div>
              </AdvancedMarker>
            );
          })}
        </>
      ) : (
        <AdvancedMarker position={anchor}>
          <Pin background="#2563eb" borderColor="#1d4ed8" glyphColor="#ffffff" />
        </AdvancedMarker>
      )}
    </GoogleMap>
  );
}
