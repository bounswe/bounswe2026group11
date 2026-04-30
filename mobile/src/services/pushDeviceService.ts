import { apiDeleteAuth, apiPutAuth } from './api';
import type {
  RegisterPushDeviceRequest,
  RegisterPushDeviceResponse,
} from '@/models/pushDevice';

export function registerPushDevice(
  installationID: string,
  data: RegisterPushDeviceRequest,
  token: string,
): Promise<RegisterPushDeviceResponse> {
  return apiPutAuth<RegisterPushDeviceResponse>(
    `/me/push-devices/${installationID}`,
    data,
    token,
  );
}

export function unregisterPushDevice(
  installationID: string,
  token: string,
): Promise<void> {
  return apiDeleteAuth<void>(`/me/push-devices/${installationID}`, token);
}
