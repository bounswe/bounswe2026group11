/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { usePushMessaging } from './usePushMessaging';
import * as deviceInstallation from '@/services/deviceInstallation';
import * as pushDeviceService from '@/services/pushDeviceService';

jest.mock('@/services/deviceInstallation');
jest.mock('@/services/pushDeviceService');

const mockGetDeviceInstallationID = jest.mocked(
  deviceInstallation.getDeviceInstallationID,
);
const mockRegisterPushDevice = jest.mocked(pushDeviceService.registerPushDevice);
const mockUnregisterPushDevice = jest.mocked(
  pushDeviceService.unregisterPushDevice,
);

describe('usePushMessaging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDeviceInstallationID.mockResolvedValue(
      '550e8400-e29b-41d4-a716-446655440000',
    );
    mockRegisterPushDevice.mockResolvedValue({
      installation_id: '550e8400-e29b-41d4-a716-446655440000',
      platform: 'IOS',
      active_device_count: 1,
      updated_at: '2026-04-30T12:00:00Z',
    });
    mockUnregisterPushDevice.mockResolvedValue(undefined);
  });

  it('registers the FCM token when an auth token is available', async () => {
    renderHook(() => usePushMessaging({ authToken: 'access-token' }));

    await waitFor(() => {
      expect(mockRegisterPushDevice).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        expect.objectContaining({
          fcm_token: 'test-fcm-token',
          platform: 'IOS',
        }),
        'access-token',
      );
    });
  });

  it('syncs a previously acquired FCM token after login', async () => {
    const { rerender } = renderHook(
      ({ authToken }: { authToken: string | null }) =>
        usePushMessaging({ authToken }),
      { initialProps: { authToken: null as string | null } },
    );

    await waitFor(() => {
      expect(mockGetDeviceInstallationID).not.toHaveBeenCalled();
    });

    rerender({ authToken: 'access-token' as string | null });

    await waitFor(() => {
      expect(mockRegisterPushDevice).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        expect.objectContaining({ fcm_token: 'test-fcm-token' }),
        'access-token',
      );
    });
  });

  it('unregisters the installation when the auth token is cleared', async () => {
    const { rerender } = renderHook(
      ({ authToken }: { authToken: string | null }) =>
        usePushMessaging({ authToken }),
      { initialProps: { authToken: 'access-token' as string | null } },
    );

    await waitFor(() => {
      expect(mockRegisterPushDevice).toHaveBeenCalled();
    });

    rerender({ authToken: null as string | null });

    await waitFor(() => {
      expect(mockUnregisterPushDevice).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        'access-token',
      );
    });
  });
});
