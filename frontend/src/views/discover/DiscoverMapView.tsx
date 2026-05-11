import { useEffect, useMemo, useState } from 'react';
import {
  AdvancedMarker,
  Map as GoogleMap,
  useMap,
  type MapCameraChangedEvent,
} from '@vis.gl/react-google-maps';
import { useTheme } from '@/contexts/ThemeContext';
import { isGoogleMapsConfigured, GOOGLE_MAPS_MAP_ID } from '@/components/GoogleMapsProvider';
import { getEventCategoryPresentation } from '@/utils/eventCategoryPresentation';
import type { DiscoverEventItem } from '@/models/event';

interface DiscoverMapViewProps {
  events: DiscoverEventItem[];
  isLoading: boolean;
  error: string | null;
  center: { lat: number; lon: number };
  radiusMeters: number;
  isChoosingLocation: boolean;
  selectedEventId: string | null;
  onSelectEvent: (eventId: string | null) => void;
  onChooseLocation: (lat: number, lon: number) => void;
  onRetry: () => void;
}

interface LatLng {
  lat: number;
  lng: number;
}

interface MappableEvent {
  event: DiscoverEventItem;
  position: { lat: number; lng: number };
  groupSize: number;
}

function getDenseKey(event: DiscoverEventItem): string {
  return `${(event.location_lat as number).toFixed(4)}:${(event.location_lon as number).toFixed(4)}`;
}

function buildMappableEvents(events: DiscoverEventItem[]): MappableEvent[] {
  const eventsWithCoords = events.filter(
    (e): e is DiscoverEventItem & { location_lat: number; location_lon: number } =>
      typeof e.location_lat === 'number' &&
      typeof e.location_lon === 'number' &&
      Number.isFinite(e.location_lat) &&
      Number.isFinite(e.location_lon),
  );

  const groups = new Map<string, number>();
  for (const e of eventsWithCoords) {
    const k = getDenseKey(e);
    groups.set(k, (groups.get(k) ?? 0) + 1);
  }

  return eventsWithCoords.map((event, idx) => {
    const key = getDenseKey(event);
    const groupSize = groups.get(key) ?? 1;
    const offset =
      groupSize > 1
        ? denseOffset(idx, groupSize)
        : { lat: 0, lng: 0 };
    return {
      event,
      position: {
        lat: (event.location_lat as number) + offset.lat,
        lng: (event.location_lon as number) + offset.lng,
      },
      groupSize,
    };
  });
}

/** Spread overlapping markers in a small ring so they don't fully overlap. */
function denseOffset(index: number, groupSize: number): { lat: number; lng: number } {
  const markersPerRing = 8;
  const ringPos = index % markersPerRing;
  const visible = Math.min(groupSize, markersPerRing);
  const angle = (Math.PI * 2 * ringPos) / visible - Math.PI / 2;
  const radius = 0.00018;
  return { lat: Math.sin(angle) * radius, lng: Math.cos(angle) * radius };
}

function MapRecenter({ center }: { center: { lat: number; lon: number } }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.panTo({ lat: center.lat, lng: center.lon });
  }, [center.lat, center.lon, map]);
  return null;
}

function buildCirclePath(center: LatLng, radiusMeters: number): LatLng[] {
  const earthRadiusMeters = 6378137;
  const lat = center.lat * Math.PI / 180;
  const lng = center.lng * Math.PI / 180;
  const angularDistance = radiusMeters / earthRadiusMeters;
  const points: LatLng[] = [];

  for (let step = 0; step <= 96; step += 1) {
    const bearing = (step / 96) * Math.PI * 2;
    const pointLat = Math.asin(
      Math.sin(lat) * Math.cos(angularDistance) +
        Math.cos(lat) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const pointLng =
      lng +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat),
        Math.cos(angularDistance) - Math.sin(lat) * Math.sin(pointLat),
      );
    points.push({
      lat: pointLat * 180 / Math.PI,
      lng: pointLng * 180 / Math.PI,
    });
  }

  return points;
}

function RadiusCircle({
  center,
  radiusMeters,
  isPreview = false,
}: {
  center: LatLng;
  radiusMeters: number;
  isPreview?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const color = isPreview ? '#111827' : '#2563eb';
    const dottedBorder = new google.maps.Polyline({
      map,
      path: buildCirclePath(center, radiusMeters),
      strokeOpacity: 0,
      clickable: false,
      zIndex: isPreview ? 9 : 5,
      icons: [
        {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: isPreview ? 2.2 : 2.5,
            fillColor: color,
            fillOpacity: 1,
            strokeOpacity: 0,
          },
          offset: '0',
          repeat: isPreview ? '14px' : '16px',
        },
      ],
    });

    return () => {
      dottedBorder.setMap(null);
    };
  }, [center, isPreview, map, radiusMeters]);

  return null;
}

function DiscoveryLocationMarker({ center }: { center: LatLng }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const element = document.createElement('div');
    element.className = 'dc-map-location-marker';
    element.setAttribute('aria-label', 'Discovery location');
    element.innerHTML = '<div class="dc-map-location-marker-dot"></div>';

    const overlay = new google.maps.OverlayView();
    overlay.onAdd = () => {
      const panes = overlay.getPanes();
      panes?.overlayLayer.appendChild(element);
    };
    overlay.draw = () => {
      const projection = overlay.getProjection();
      if (!projection) return;
      const point = projection.fromLatLngToDivPixel(
        new google.maps.LatLng(center.lat, center.lng),
      );
      if (!point) return;
      element.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
    };
    overlay.onRemove = () => {
      element.remove();
    };
    overlay.setMap(map);

    return () => {
      overlay.setMap(null);
    };
  }, [center, map]);

  return null;
}

function MapLocationPicker({
  enabled,
  radiusMeters,
  onChooseLocation,
}: {
  enabled: boolean;
  radiusMeters: number;
  onChooseLocation: (lat: number, lon: number) => void;
}) {
  const map = useMap();
  const [previewCenter, setPreviewCenter] = useState<LatLng | null>(null);

  useEffect(() => {
    if (!map || !enabled) {
      setPreviewCenter(null);
      return;
    }

    const previousDraggableCursor = map.get('draggableCursor') as string | null | undefined;
    map.setOptions({ draggableCursor: 'crosshair' });

    const moveListener = map.addListener('mousemove', (event: google.maps.MapMouseEvent) => {
      if (!event.latLng) return;
      setPreviewCenter({ lat: event.latLng.lat(), lng: event.latLng.lng() });
    });
    const clickListener = map.addListener('click', (event: google.maps.MapMouseEvent) => {
      if (!event.latLng) return;
      onChooseLocation(event.latLng.lat(), event.latLng.lng());
      setPreviewCenter(null);
    });
    const outListener = map.addListener('mouseout', () => {
      setPreviewCenter(null);
    });

    return () => {
      moveListener?.remove();
      clickListener?.remove();
      outListener?.remove();
      map.setOptions({ draggableCursor: previousDraggableCursor ?? null });
      setPreviewCenter(null);
    };
  }, [enabled, map, onChooseLocation]);

  return previewCenter ? (
    <RadiusCircle center={previewCenter} radiusMeters={radiusMeters} isPreview />
  ) : null;
}

function MapNotConfigured() {
  return (
    <div className="dc-map-overlay" role="status">
      <h3>Map unavailable</h3>
      <p>Set <code>VITE_GOOGLE_MAPS_WEB_API_KEY</code> in your local environment to enable the Google Maps view.</p>
    </div>
  );
}

export default function DiscoverMapView({
  events,
  isLoading,
  error,
  center,
  radiusMeters,
  isChoosingLocation,
  selectedEventId,
  onSelectEvent,
  onChooseLocation,
  onRetry,
}: DiscoverMapViewProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const configured = isGoogleMapsConfigured();

  const mappable = useMemo(() => buildMappableEvents(events), [events]);

  useEffect(() => {
    if (selectedEventId && !mappable.some((m) => m.event.id === selectedEventId)) {
      onSelectEvent(null);
    }
  }, [mappable, onSelectEvent, selectedEventId]);

  return (
    <div className="dc-map-wrapper" data-testid="discover-map">
      {configured ? (
        <GoogleMap
          key={isDark ? 'dark' : 'light'}
          mapId={GOOGLE_MAPS_MAP_ID}
          defaultCenter={{ lat: center.lat, lng: center.lon }}
          defaultZoom={12}
          colorScheme={isDark ? 'DARK' : 'LIGHT'}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          clickableIcons={false}
          onClick={() => onSelectEvent(null)}
          onCameraChanged={(_e: MapCameraChangedEvent) => {
            /* keep camera in user control */
          }}
          className="dc-map-surface"
        >
          <MapRecenter center={center} />
          <RadiusCircle
            center={{ lat: center.lat, lng: center.lon }}
            radiusMeters={radiusMeters}
          />
          <MapLocationPicker
            enabled={isChoosingLocation}
            radiusMeters={radiusMeters}
            onChooseLocation={onChooseLocation}
          />
          <DiscoveryLocationMarker center={{ lat: center.lat, lng: center.lon }} />
          {mappable.map((item) => {
            const presentation = getEventCategoryPresentation(
              item.event.category_name ?? '',
              isDark,
            );
            const isSelected = item.event.id === selectedEventId;
            return (
              <AdvancedMarker
                key={item.event.id}
                position={item.position}
                onClick={() => onSelectEvent(item.event.id)}
                zIndex={isSelected ? 1000 : 1}
              >
                <div
                  className={`dc-map-marker ${isSelected ? 'dc-map-marker--selected' : ''}`}
                  data-testid={`marker-${item.event.id}`}
                >
                  <div
                    className="dc-map-marker-bubble"
                    style={{ background: presentation.color }}
                  >
                    <span className="dc-map-marker-emoji">{presentation.emoji}</span>
                    {item.groupSize > 1 && (
                      <span className="dc-map-marker-count">{item.groupSize}</span>
                    )}
                  </div>
                  <div
                    className="dc-map-marker-tail"
                    style={{ borderTopColor: presentation.color }}
                  />
                </div>
              </AdvancedMarker>
            );
          })}
        </GoogleMap>
      ) : (
        <MapNotConfigured />
      )}

      {isLoading && (
        <div className="dc-map-overlay" role="status" aria-live="polite">
          <span className="spinner" />
          <p>Loading events...</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="dc-map-overlay dc-map-overlay-error" role="alert">
          <p>{error}</p>
          <button type="button" className="dc-retry-btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}

      {configured && !isLoading && !error && mappable.length === 0 && (
        <div className="dc-map-overlay dc-map-overlay-empty" role="status">
          <h3>No events on the map</h3>
          <p>Try adjusting filters or expanding the radius.</p>
        </div>
      )}
    </div>
  );
}
