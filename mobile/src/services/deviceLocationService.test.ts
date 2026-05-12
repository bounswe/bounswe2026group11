import * as ExpoLocation from 'expo-location';
import {
  CURRENT_LOCATION_LABEL,
  getCurrentLocationSuggestion,
} from '@/services/deviceLocationService';

const mockLocation = ExpoLocation as jest.Mocked<typeof ExpoLocation>;

describe('deviceLocationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: ExpoLocation.PermissionStatus.GRANTED,
    } as ExpoLocation.LocationPermissionResponse);
    mockLocation.getLastKnownPositionAsync.mockResolvedValue(null);
    mockLocation.getCurrentPositionAsync.mockResolvedValue({
      coords: {
        latitude: 40.9869,
        longitude: 29.0287,
      },
    } as ExpoLocation.LocationObject);
    mockLocation.reverseGeocodeAsync.mockResolvedValue([
      {
        formattedAddress: 'Moda, Kadikoy, Istanbul',
      },
    ] as ExpoLocation.LocationGeocodedAddress[]);
  });

  it('uses a recent cached location before requesting a fresh position', async () => {
    mockLocation.getLastKnownPositionAsync.mockResolvedValueOnce({
      coords: {
        latitude: 41.043,
        longitude: 29.0095,
      },
    } as ExpoLocation.LocationObject);

    const location = await getCurrentLocationSuggestion();

    expect(mockLocation.getLastKnownPositionAsync).toHaveBeenCalledWith({
      maxAge: 300000,
      requiredAccuracy: 5000,
    });
    expect(mockLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(location).toEqual({
      display_name: 'Moda, Kadikoy, Istanbul',
      lat: '41.043',
      lon: '29.0095',
    });
  });

  it('keeps the coordinates when reverse geocoding fails', async () => {
    mockLocation.reverseGeocodeAsync.mockRejectedValueOnce(new Error('Geocoder timed out'));

    const location = await getCurrentLocationSuggestion();

    expect(location).toEqual({
      display_name: CURRENT_LOCATION_LABEL,
      lat: '40.9869',
      lon: '29.0287',
    });
  });

  it('uses a watched position when one-shot current location is unavailable', async () => {
    mockLocation.getCurrentPositionAsync.mockRejectedValueOnce(
      new Error('Current location is unavailable'),
    );
    mockLocation.watchPositionAsync.mockImplementationOnce(async (_options, callback) => {
      callback({
        coords: {
          latitude: 41.0422,
          longitude: 29.0083,
        },
      } as ExpoLocation.LocationObject);

      return { remove: jest.fn() } as ExpoLocation.LocationSubscription;
    });

    const location = await getCurrentLocationSuggestion();

    expect(mockLocation.watchPositionAsync).toHaveBeenCalledTimes(1);
    expect(location).toEqual({
      display_name: 'Moda, Kadikoy, Istanbul',
      lat: '41.0422',
      lon: '29.0083',
    });
  });
});
