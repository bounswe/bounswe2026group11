module.exports = {
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
  Accuracy: {
    Balanced: 3,
  },
  requestForegroundPermissionsAsync: jest.fn(async () => ({
    status: 'denied',
  })),
  hasServicesEnabledAsync: jest.fn(async () => true),
  getProviderStatusAsync: jest.fn(async () => ({
    locationServicesEnabled: true,
  })),
  enableNetworkProviderAsync: jest.fn(async () => undefined),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: {
      latitude: 0,
      longitude: 0,
    },
  })),
  getLastKnownPositionAsync: jest.fn(async () => null),
  watchPositionAsync: jest.fn(async () => ({
    remove: jest.fn(),
  })),
  reverseGeocodeAsync: jest.fn(async () => []),
};
