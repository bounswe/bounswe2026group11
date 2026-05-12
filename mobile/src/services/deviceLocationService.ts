import * as ExpoLocation from 'expo-location';
import { Platform } from 'react-native';
import type { LocationSuggestion } from '@/models/event';

export const CURRENT_LOCATION_LABEL = 'Current location';
const LAST_KNOWN_LOCATION_MAX_AGE_MS = 5 * 60 * 1000;
const LAST_KNOWN_LOCATION_REQUIRED_ACCURACY_METERS = 5000;
const WATCH_POSITION_FALLBACK_TIMEOUT_MS = 15000;

type AndroidProviderStatus = Awaited<ReturnType<typeof ExpoLocation.getProviderStatusAsync>>;

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

async function getFreshPosition(useGpsOnly = false): Promise<ExpoLocation.LocationObject> {
  const locationOptions: ExpoLocation.LocationOptions = {
    accuracy: useGpsOnly ? ExpoLocation.Accuracy.High : ExpoLocation.Accuracy.Balanced,
    mayShowUserSettingsDialog: !useGpsOnly,
  };

  try {
    return await ExpoLocation.getCurrentPositionAsync(locationOptions);
  } catch {
    // Fall back to a short watch because Android emulators can fail one-shot
    // requests even when providers are enabled, while still emitting updates.
  }

  return new Promise((resolve, reject) => {
    let subscription: ExpoLocation.LocationSubscription | null = null;
    let isSettled = false;

    const timeoutId = setTimeout(() => {
      if (isSettled) return;
      isSettled = true;
      subscription?.remove();
      reject(new Error('Timed out waiting for location update'));
    }, WATCH_POSITION_FALLBACK_TIMEOUT_MS);

    ExpoLocation.watchPositionAsync(
      {
        ...locationOptions,
        timeInterval: 1000,
        distanceInterval: 0,
      },
      (position) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timeoutId);
        subscription?.remove();
        resolve(position);
      },
      (error) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timeoutId);
        subscription?.remove();
        reject(new Error(error));
      },
    )
      .then((nextSubscription) => {
        subscription = nextSubscription;
      })
      .catch((error) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export async function getCurrentLocationSuggestion(): Promise<LocationSuggestion | null> {
  try {
    const permission = await ExpoLocation.requestForegroundPermissionsAsync();

    if (permission.status !== ExpoLocation.PermissionStatus.GRANTED) {
      return null;
    }

    const hasLocationServicesEnabled = await ExpoLocation.hasServicesEnabledAsync();

    if (!hasLocationServicesEnabled) {
      return null;
    }

    let androidProviderStatus: AndroidProviderStatus | null = null;

    if (Platform.OS === 'android') {
      try {
        androidProviderStatus = await ExpoLocation.getProviderStatusAsync();

        if (androidProviderStatus.networkAvailable) {
          await ExpoLocation.enableNetworkProviderAsync();
        }
      } catch {
        // Some emulators reject the network-provider prompt. Keep resolving via
        // GPS/current providers instead of falling back immediately.
      }
    }

    const cachedPosition = await ExpoLocation.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_LOCATION_MAX_AGE_MS,
      requiredAccuracy: LAST_KNOWN_LOCATION_REQUIRED_ACCURACY_METERS,
    });

    const position =
      cachedPosition ??
      (await getFreshPosition(
        Platform.OS === 'android' && androidProviderStatus?.networkAvailable === false,
      ).catch(async (error) => {
        const relaxedCachedPosition = await ExpoLocation.getLastKnownPositionAsync();

        if (relaxedCachedPosition) {
          return relaxedCachedPosition;
        }

        throw error;
      }));

    let displayName = CURRENT_LOCATION_LABEL;

    try {
      const addresses = await ExpoLocation.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      displayName = buildAddressLabel(addresses[0]);
    } catch {
      displayName = CURRENT_LOCATION_LABEL;
    }

    return {
      display_name: displayName,
      lat: String(position.coords.latitude),
      lon: String(position.coords.longitude),
    };
  } catch {
    return null;
  }
}
