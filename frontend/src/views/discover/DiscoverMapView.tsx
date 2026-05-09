import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EventCoverImage } from '@/components/EventCoverImage';
import type { DiscoverEventItem } from '@/models/event';
import { getApproximateLocationText } from '@/utils/locationApproximation';

interface DiscoverMapViewProps {
  events: DiscoverEventItem[];
  isLoading: boolean;
  error: string | null;
  center: { lat: number; lon: number };
  onRetry: () => void;
}

const MARKER_COLORS = [
  '#7c3aed', // violet
  '#2563eb', // blue
  '#0891b2', // cyan
  '#059669', // emerald
  '#ca8a04', // amber
  '#dc2626', // red
  '#db2777', // pink
  '#9333ea', // purple
];

function colorForCategory(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) | 0;
  }
  return MARKER_COLORS[Math.abs(hash) % MARKER_COLORS.length];
}

function buildCategoryIcon(category: string, isSelected: boolean): L.DivIcon {
  const letter = (category?.[0] ?? '?').toUpperCase();
  const color = colorForCategory(category ?? '');
  const size = isSelected ? 44 : 38;
  const ring = isSelected ? '3px solid #ffffff' : '2px solid #ffffff';
  const shadow = isSelected
    ? '0 6px 16px rgba(0,0,0,0.35), 0 0 0 4px rgba(124,58,237,0.18)'
    : '0 3px 8px rgba(0,0,0,0.25)';
  const html = `
    <div style="
      width:${size}px;
      height:${size}px;
      border-radius:50%;
      background:${color};
      color:#ffffff;
      border:${ring};
      box-shadow:${shadow};
      display:flex;
      align-items:center;
      justify-content:center;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-weight:700;
      font-size:${isSelected ? 17 : 15}px;
      line-height:1;
      transition:transform 0.15s;
    ">${letter}</div>
  `;
  return L.divIcon({
    html,
    className: 'dc-map-cat-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function MapRecenter({ center }: { center: { lat: number; lon: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lon], map.getZoom(), { animate: true });
  }, [center.lat, center.lon, map]);
  return null;
}

function EventOverlayCard({
  event,
  onClose,
}: {
  event: DiscoverEventItem;
  onClose: () => void;
}) {
  const color = colorForCategory(event.category_name ?? '');

  return (
    <div className="dc-map-card" role="dialog" aria-label={`Event: ${event.title}`}>
      <button
        type="button"
        className="dc-map-card-close"
        onClick={onClose}
        aria-label="Close event preview"
      >
        ×
      </button>

      <div className="dc-map-card-image">
        <EventCoverImage
          src={event.image_url}
          alt={event.title}
          imgClassName="dc-map-card-image-img"
          variant="card"
        />
        <span
          className="dc-map-card-category"
          style={{ background: color }}
        >
          {event.category_name}
        </span>
      </div>

      <div className="dc-map-card-body">
        <h3 className="dc-map-card-title">{event.title}</h3>

        <div className="dc-map-card-meta-row">
          <span className="dc-map-card-meta">
            {formatDate(event.start_time)} · {formatTime(event.start_time)}
          </span>
        </div>

        {event.location_address && (
          <p className="dc-map-card-address">{event.location_address}</p>
        )}
        {event.is_location_approximate && (
          <span className="dc-approx-location-badge dc-map-approx-location-badge">
            {getApproximateLocationText(Boolean(event.location_address))}
          </span>
        )}

        <div className="dc-map-card-footer">
          <span className="dc-map-card-participants">
            {event.approved_participant_count} participant
            {event.approved_participant_count !== 1 ? 's' : ''}
          </span>
          {event.host_score.final_score != null && (
            <span className="dc-map-card-score">
              ★ {event.host_score.final_score.toFixed(1)}
            </span>
          )}
        </div>

        <Link
          to={`/events/${event.id}`}
          className="dc-map-card-cta"
        >
          View Details &rarr;
        </Link>
      </div>
    </div>
  );
}

export default function DiscoverMapView({
  events,
  isLoading,
  error,
  center,
  onRetry,
}: DiscoverMapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const mappableEvents = useMemo(
    () => events.filter((e) => e.location_lat != null && e.location_lon != null),
    [events],
  );

  useEffect(() => {
    if (selectedEventId && !mappableEvents.find((e) => e.id === selectedEventId)) {
      setSelectedEventId(null);
    }
  }, [mappableEvents, selectedEventId]);

  const selectedEvent = mappableEvents.find((e) => e.id === selectedEventId) ?? null;

  return (
    <div className="dc-map-wrapper" data-testid="discover-map">
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={12}
        scrollWheelZoom
        className="dc-map-surface"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapRecenter center={center} />
        {mappableEvents.map((event) => (
          <Marker
            key={event.id}
            position={[event.location_lat as number, event.location_lon as number]}
            icon={buildCategoryIcon(event.category_name ?? '', event.id === selectedEventId)}
            eventHandlers={{
              click: () => setSelectedEventId(event.id),
            }}
            zIndexOffset={event.id === selectedEventId ? 1000 : 0}
          />
        ))}
      </MapContainer>

      {selectedEvent && (
        <EventOverlayCard
          event={selectedEvent}
          onClose={() => setSelectedEventId(null)}
        />
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

      {!isLoading && !error && mappableEvents.length === 0 && (
        <div className="dc-map-overlay dc-map-overlay-empty" role="status">
          <h3>No events on the map</h3>
          <p>Try adjusting filters or expanding the radius.</p>
        </div>
      )}
    </div>
  );
}
