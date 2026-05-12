import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdvancedMarker,
  Map as GoogleMap,
  useMap,
} from '@vis.gl/react-google-maps';
import { useTheme } from '@/contexts/ThemeContext';
import { GOOGLE_MAPS_MAP_ID, isGoogleMapsConfigured } from '@/components/GoogleMapsProvider';
import type { LocationSuggestion } from '@/models/event';
import { reverseGeocode } from '@/services/eventService';

interface PointLocationPickerProps {
  lat: number | null;
  lon: number | null;
  address?: string | null;
  disabled?: boolean;
  onSelect: (suggestion: LocationSuggestion) => void;
}

interface LatLng {
  lat: number;
  lng: number;
}

function MapClickHandler({
  disabled,
  onMapClick,
}: {
  disabled?: boolean;
  onMapClick: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || disabled) return;
    const listener = map.addListener('click', (event: google.maps.MapMouseEvent) => {
      if (event.latLng) {
        onMapClick(event.latLng.lat(), event.latLng.lng());
      }
    });
    return () => listener.remove();
  }, [disabled, map, onMapClick]);

  return null;
}

function MapRecenter({ center }: { center: LatLng }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.panTo(center);
  }, [center, map]);

  return null;
}

function makeCoordinateSuggestion(lat: number, lon: number, displayName?: string | null): LocationSuggestion {
  return {
    display_name: displayName?.trim() || `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
    lat: String(lat),
    lon: String(lon),
  };
}

export default function PointLocationPicker({
  lat,
  lon,
  address,
  disabled,
  onSelect,
}: PointLocationPickerProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const configured = isGoogleMapsConfigured();
  const [isResolving, setIsResolving] = useState(false);

  const center = useMemo<LatLng>(() => {
    if (lat != null && lon != null) return { lat, lng: lon };
    return { lat: 41.0082, lng: 28.9784 };
  }, [lat, lon]);

  const handleMapClick = useCallback(
    async (clickedLat: number, clickedLng: number) => {
      if (disabled) return;
      setIsResolving(true);
      try {
        const resolved = await reverseGeocode(clickedLat, clickedLng);
        onSelect(makeCoordinateSuggestion(clickedLat, clickedLng, resolved?.display_name));
      } catch {
        onSelect(makeCoordinateSuggestion(clickedLat, clickedLng));
      } finally {
        setIsResolving(false);
      }
    },
    [disabled, onSelect],
  );

  if (!configured) {
    return (
      <div className="ce-point-map-placeholder">
        Set <code>VITE_GOOGLE_MAPS_WEB_API_KEY</code> to choose a point on the map.
      </div>
    );
  }

  return (
    <div className="ce-point-map">
      <GoogleMap
        key={isDark ? 'dark' : 'light'}
        mapId={GOOGLE_MAPS_MAP_ID}
        defaultCenter={center}
        defaultZoom={lat != null && lon != null ? 14 : 11}
        colorScheme={isDark ? 'DARK' : 'LIGHT'}
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        clickableIcons={false}
        className="ce-point-map-surface"
      >
        <MapClickHandler disabled={disabled} onMapClick={handleMapClick} />
        <MapRecenter center={center} />
        {lat != null && lon != null && (
          <AdvancedMarker position={{ lat, lng: lon }}>
            <div className="ce-point-marker" aria-label={address ?? 'Selected location'}>
              <span />
            </div>
          </AdvancedMarker>
        )}
      </GoogleMap>
      <div className="ce-point-map-footer">
        {isResolving ? 'Resolving address...' : 'Click the map to choose the event point.'}
      </div>
    </div>
  );
}
