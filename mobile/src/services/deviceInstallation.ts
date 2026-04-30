import * as SecureStore from 'expo-secure-store';

const DEVICE_INSTALLATION_ID_KEY = 'device_installation_id';

function newInstallationID(): string {
  const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (randomUUID) {
    return randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = char === 'x' ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

export async function getDeviceInstallationID(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_INSTALLATION_ID_KEY);
  if (existing) {
    return existing;
  }

  const installationID = newInstallationID();
  await SecureStore.setItemAsync(DEVICE_INSTALLATION_ID_KEY, installationID);
  return installationID;
}
