import { useMemo } from 'react';
import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { EventDetailLocation } from '@/models/event';

interface EventDetailMiniMapProps {
  location: EventDetailLocation;
}

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function EventDetailMiniMap({ location }: EventDetailMiniMapProps) {
  const anchor = useMemo(() => {
    if (location.type === 'POINT' && location.point) {
      return { lat: location.point.lat, lon: location.point.lon };
    }
    if (location.type === 'ROUTE' && location.route_points.length > 0) {
      return { lat: location.route_points[0].lat, lon: location.route_points[0].lon };
    }
    return null;
  }, [location]);

  if (!anchor) {
    return null;
  }

  const polylinePositions: [number, number][] =
    location.type === 'ROUTE'
      ? location.route_points.map((p) => [p.lat, p.lon])
      : [];

  return (
    <MapContainer
      center={[anchor.lat, anchor.lon]}
      zoom={14}
      scrollWheelZoom={false}
      className="ed-map-surface"
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[anchor.lat, anchor.lon]} icon={markerIcon} />
      {polylinePositions.length > 1 && (
        <Polyline positions={polylinePositions} pathOptions={{ color: '#7c3aed', weight: 4 }} />
      )}
    </MapContainer>
  );
}
