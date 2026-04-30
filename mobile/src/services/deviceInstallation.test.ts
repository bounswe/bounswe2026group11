import * as SecureStore from 'expo-secure-store';
import { getDeviceInstallationID } from './deviceInstallation';

describe('deviceInstallation', () => {
  beforeEach(() => {
    (SecureStore as unknown as { __reset: () => void }).__reset();
    jest.clearAllMocks();
  });

  it('creates and persists an installation id when none exists', async () => {
    const installationID = await getDeviceInstallationID();

    expect(installationID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'device_installation_id',
      installationID,
    );
  });

  it('returns the stored installation id without replacing it', async () => {
    await SecureStore.setItemAsync(
      'device_installation_id',
      '550e8400-e29b-41d4-a716-446655440000',
    );
    jest.clearAllMocks();

    const installationID = await getDeviceInstallationID();

    expect(installationID).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});
