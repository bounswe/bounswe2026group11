import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  Map as GoogleMap,
  useMap,
} from '@vis.gl/react-google-maps';
import { useTheme } from '@/contexts/ThemeContext';
import { GOOGLE_MAPS_MAP_ID, isGoogleMapsConfigured } from '@/components/GoogleMapsProvider';
import type { LocationSuggestion } from '@/models/event';
import type { RouteWaypoint } from '@/viewmodels/event/useCreateEventViewModel';
import { fetchRoutedGeometry, reverseGeocode } from '@/services/eventService';

const ROUTED_GEOMETRY_DEBOUNCE_MS = 400;

interface RoutePointsEditorProps {
  routePoints: RouteWaypoint[];
  locationQuery: string;
  isSearching: boolean;
  suggestions: LocationSuggestion[];
  errorText?: string | null;
  disabled?: boolean;
  onSearch: (query: string) => void;
  onAddFromSuggestion: (suggestion: LocationSuggestion) => void;
  onAddFromCoordinate: (lat: number, lon: number, label?: string | null) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onUpdateLabel: (index: number, label: string) => void;
}

interface LatLng {
  lat: number;
  lng: number;
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

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  const prevLengthRef = useRef(0);
  useEffect(() => {
    if (!map || points.length < 2) return;
    if (points.length !== prevLengthRef.current) {
      const bounds = new google.maps.LatLngBounds();
      for (const p of points) bounds.extend(p);
      map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
    }
    prevLengthRef.current = points.length;
  }, [map, points]);
  return null;
}

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        onMapClick(e.latLng.lat(), e.latLng.lng());
      }
    });
    return () => listener.remove();
  }, [map, onMapClick]);
  return null;
}

export default function RoutePointsEditor({
  routePoints,
  locationQuery,
  isSearching,
  suggestions,
  errorText,
  disabled,
  onSearch,
  onAddFromSuggestion,
  onAddFromCoordinate,
  onRemove,
  onMove,
  onUpdateLabel,
}: RoutePointsEditorProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const configured = isGoogleMapsConfigured();
  const [routedGeometry, setRoutedGeometry] = useState<LatLng[] | null>(null);

  useEffect(() => {
    if (routePoints.length < 2) {
      setRoutedGeometry(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      fetchRoutedGeometry(routePoints.map((p) => ({ lat: p.lat, lon: p.lon })))
        .then((geom) => {
          if (!cancelled && geom && geom.length >= 2) {
            setRoutedGeometry(geom.map((p) => ({ lat: p.lat, lng: p.lon })));
          }
        })
        .catch(() => {
          if (!cancelled) setRoutedGeometry(null);
        });
    }, ROUTED_GEOMETRY_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [routePoints]);

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (disabled) return;
      const insertIndex = routePoints.length;
      onAddFromCoordinate(lat, lng);
      try {
        const result = await reverseGeocode(lat, lng);
        if (result?.display_name) {
          onUpdateLabel(insertIndex, result.display_name);
        }
      } catch {
        // best-effort reverse geocode
      }
    },
    [disabled, routePoints.length, onAddFromCoordinate, onUpdateLabel],
  );

  const waypointLatLngs = useMemo<LatLng[]>(
    () => routePoints.map((p) => ({ lat: p.lat, lng: p.lon })),
    [routePoints],
  );

  const polylineCoords = useMemo<LatLng[]>(() => {
    if (routedGeometry && routedGeometry.length >= 2) return routedGeometry;
    return waypointLatLngs;
  }, [routedGeometry, waypointLatLngs]);

  const defaultCenter = useMemo<LatLng>(() => {
    if (routePoints.length > 0) {
      return { lat: routePoints[0].lat, lng: routePoints[0].lon };
    }
    return { lat: 41.0082, lng: 28.9784 };
  }, [routePoints]);

  return (
    <div className="ce-route-editor">
      {/* Search */}
      <div className="ce-route-search-row">
        <input
          type="text"
          className={`field-input ${errorText ? 'has-error' : ''}`}
          placeholder="Search a place to add a waypoint..."
          value={locationQuery}
          onChange={(e) => onSearch(e.target.value)}
          disabled={disabled}
        />
        {isSearching && <span className="spinner ce-route-search-spinner" />}
      </div>

      {suggestions.length > 0 && (
        <ul className="ce-route-suggestions">
          {suggestions.map((s, i) => (
            <li key={`${s.lat}-${s.lon}-${i}`}>
              <button
                type="button"
                className="ce-route-suggestion-item"
                onClick={() => onAddFromSuggestion(s)}
              >
                <span className="ce-route-suggestion-plus">+</span>
                <span className="ce-route-suggestion-text">{s.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="ce-route-hint">
        Or click on the map to add a waypoint.
      </p>

      {/* Map */}
      {configured ? (
        <div className="ce-route-map-container">
          <GoogleMap
            key={isDark ? 'dark' : 'light'}
            mapId={GOOGLE_MAPS_MAP_ID}
            defaultCenter={defaultCenter}
            defaultZoom={12}
            colorScheme={isDark ? 'DARK' : 'LIGHT'}
            gestureHandling="greedy"
            disableDefaultUI={false}
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl={false}
            clickableIcons={false}
            className="ce-route-map-surface"
          >
            <MapClickHandler onMapClick={handleMapClick} />
            {waypointLatLngs.length >= 2 && <FitBounds points={waypointLatLngs} />}
            {waypointLatLngs.length >= 2 && <RoutePolyline path={polylineCoords} />}
            {routePoints.map((p, i) => (
              <AdvancedMarker
                key={`${p.lat}-${p.lon}-${i}`}
                position={{ lat: p.lat, lng: p.lon }}
              >
                <div className="ce-route-marker">
                  <div
                    className={`ce-route-marker-dot ${i === 0 ? 'ce-route-marker-dot--start' : ''} ${i === routePoints.length - 1 && routePoints.length > 1 ? 'ce-route-marker-dot--end' : ''}`}
                  >
                    <span className="ce-route-marker-number">{i + 1}</span>
                  </div>
                </div>
              </AdvancedMarker>
            ))}
          </GoogleMap>
        </div>
      ) : (
        <div className="ce-route-map-placeholder">
          Set <code>VITE_GOOGLE_MAPS_API_KEY</code> to enable the map for route creation.
        </div>
      )}

      {/* Waypoints list */}
      <div className="ce-route-list-header">
        Waypoints {routePoints.length > 0 ? `(${routePoints.length})` : ''}
      </div>

      {routePoints.length === 0 ? (
        <div className="ce-route-empty">
          No waypoints yet. Add at least 2 to continue.
        </div>
      ) : (
        <div className="ce-route-waypoints">
          {routePoints.map((p, i) => (
            <div
              key={`waypoint-${i}-${p.lat}-${p.lon}`}
              className="ce-route-waypoint"
            >
              <div
                className={`ce-route-waypoint-index ${i === 0 ? 'ce-route-waypoint-index--start' : ''} ${i === routePoints.length - 1 && routePoints.length > 1 ? 'ce-route-waypoint-index--end' : ''}`}
              >
                {i + 1}
              </div>
              <div className="ce-route-waypoint-info">
                <span className="ce-route-waypoint-label">
                  {p.label ?? `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`}
                </span>
                {p.label && (
                  <span className="ce-route-waypoint-coords">
                    {p.lat.toFixed(5)}, {p.lon.toFixed(5)}
                  </span>
                )}
              </div>
              <div className="ce-route-waypoint-actions">
                <button
                  type="button"
                  className="ce-route-action-btn"
                  onClick={() => onMove(i, -1)}
                  disabled={i === 0 || disabled}
                  aria-label="Move up"
                  title="Move up"
                >
                  &#8593;
                </button>
                <button
                  type="button"
                  className="ce-route-action-btn"
                  onClick={() => onMove(i, 1)}
                  disabled={i === routePoints.length - 1 || disabled}
                  aria-label="Move down"
                  title="Move down"
                >
                  &#8595;
                </button>
                <button
                  type="button"
                  className="ce-route-action-btn ce-route-action-btn--danger"
                  onClick={() => onRemove(i)}
                  disabled={disabled}
                  aria-label="Remove"
                  title="Remove"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {errorText && <p className="field-error">{errorText}</p>}
    </div>
  );
}
