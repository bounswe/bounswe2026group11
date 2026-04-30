export type PushDevicePlatform = 'IOS' | 'ANDROID';

export interface RegisterPushDeviceRequest {
  fcm_token: string;
  platform: PushDevicePlatform;
  device_info?: string | null;
}

export interface RegisterPushDeviceResponse {
  installation_id: string;
  platform: PushDevicePlatform;
  active_device_count: number;
  updated_at: string;
}
