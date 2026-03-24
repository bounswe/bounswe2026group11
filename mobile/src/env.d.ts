declare namespace NodeJS {
  interface ProcessEnv {
    /** Optional override, e.g. `http://192.168.1.10/api` for a physical device. */
    EXPO_PUBLIC_API_BASE_URL?: string;
  }
}
