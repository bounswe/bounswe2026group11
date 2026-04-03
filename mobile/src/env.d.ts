declare namespace NodeJS {
  interface ProcessEnv {
    /** Optional override, e.g. `http://192.168.1.10/api` for a physical device. */
    EXPO_PUBLIC_API_BASE_URL?: string;
  }
}

declare module 'expo-image-picker' {
  export interface MediaLibraryPermissionResponse {
    status: string;
  }

  export interface ImagePickerAsset {
    uri: string;
  }

  export type ImagePickerResult =
    | { canceled: true; assets: [] }
    | { canceled: false; assets: ImagePickerAsset[] };

  export function requestMediaLibraryPermissionsAsync(): Promise<MediaLibraryPermissionResponse>;
  export function launchImageLibraryAsync(options?: {
    mediaTypes?: string[];
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
  }): Promise<ImagePickerResult>;
}

declare module 'expo-image-manipulator' {
  export const SaveFormat: {
    JPEG: string;
    PNG: string;
  };

  export function manipulateAsync(
    uri: string,
    actions: Array<{ resize?: { width?: number; height?: number } }>,
    saveOptions: { compress?: number; format?: string },
  ): Promise<{ uri: string }>;
}
