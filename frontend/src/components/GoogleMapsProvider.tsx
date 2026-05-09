import { type ReactNode } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export const GOOGLE_MAPS_MAP_ID =
  import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'sem_discover_map';

export const isGoogleMapsConfigured = (): boolean =>
  typeof API_KEY === 'string' && API_KEY.trim().length > 0;

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  if (!isGoogleMapsConfigured()) {
    return <>{children}</>;
  }
  return (
    <APIProvider apiKey={API_KEY as string} libraries={['marker']}>
      {children}
    </APIProvider>
  );
}
