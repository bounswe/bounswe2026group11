import * as ExpoLocation from 'expo-location';
import type { LocationSuggestion } from '@/models/event';

export const CURRENT_LOCATION_LABEL = 'Current location';

function buildAddressLabel(
  geocodedAddress?: ExpoLocation.LocationGeocodedAddress,
): string {
  if (!geocodedAddress) {
    return CURRENT_LOCATION_LABEL;
  }

  if (geocodedAddress.formattedAddress) {
    return geocodedAddress.formattedAddress;
  }

  const parts = [
    geocodedAddress.name,
    geocodedAddress.streetNumber && geocodedAddress.street
      ? `${geocodedAddress.street} ${geocodedAddress.streetNumber}`
      : geocodedAddress.street,
    geocodedAddress.district,
    geocodedAddress.city,
    geocodedAddress.region,
    geocodedAddress.country,
  ].filter((value): value is string => Boolean(value?.trim()));

  const uniqueParts = parts.filter(
    (part, index) =>
      index === parts.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()),
  );

  return uniqueParts.join(', ') || CURRENT_LOCATION_LABEL;
}

export async function getCurrentLocationSuggestion(): Promise<LocationSuggestion | null> {
  try {
    const permission = await ExpoLocation.requestForegroundPermissionsAsync();

    if (permission.status !== ExpoLocation.PermissionStatus.GRANTED) {
      return null;
    }

    const position = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.Balanced,
    });

    const addresses = await ExpoLocation.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });

    return {
      display_name: buildAddressLabel(addresses[0]),
      lat: String(position.coords.latitude),
      lon: String(position.coords.longitude),
    };
  } catch {
    return null;
  }
}
