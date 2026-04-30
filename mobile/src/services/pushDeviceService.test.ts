import {
  registerPushDevice,
  unregisterPushDevice,
} from './pushDeviceService';
import * as api from './api';

jest.mock('./api');

const mockApiPutAuth = jest.mocked(api.apiPutAuth);
const mockApiDeleteAuth = jest.mocked(api.apiDeleteAuth);

describe('pushDeviceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiPutAuth.mockResolvedValue({
      installation_id: '550e8400-e29b-41d4-a716-446655440000',
      platform: 'IOS',
      active_device_count: 1,
      updated_at: '2026-04-30T12:00:00Z',
    });
    mockApiDeleteAuth.mockResolvedValue(undefined);
  });

  it('registers the installation fcm token through the authenticated API', async () => {
    await registerPushDevice(
      '550e8400-e29b-41d4-a716-446655440000',
      {
        fcm_token: 'fcm-token',
        platform: 'IOS',
        device_info: 'ios 26',
      },
      'access-token',
    );

    expect(mockApiPutAuth).toHaveBeenCalledWith(
      '/me/push-devices/550e8400-e29b-41d4-a716-446655440000',
      {
        fcm_token: 'fcm-token',
        platform: 'IOS',
        device_info: 'ios 26',
      },
      'access-token',
    );
  });

  it('unregisters the installation through the authenticated API', async () => {
    await unregisterPushDevice(
      '550e8400-e29b-41d4-a716-446655440000',
      'access-token',
    );

    expect(mockApiDeleteAuth).toHaveBeenCalledWith(
      '/me/push-devices/550e8400-e29b-41d4-a716-446655440000',
      'access-token',
    );
  });
});
