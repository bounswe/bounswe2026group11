import { useEffect, useMemo } from 'react';
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
  selectedEventId: string | null;
  onSelectEvent: (eventId: string | null) => void;
  onRetry: () => void;
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
  selectedEventId,
  onSelectEvent,
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
