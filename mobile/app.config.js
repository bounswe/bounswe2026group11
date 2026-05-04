// app.config.js extends app.json and injects secrets that must not be committed.
// Expo reads this file automatically when it is present alongside app.json.
// @ts-check

/** @type {import('@expo/config').ConfigContext} */
module.exports = ({ config }) => {
  const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '';

  // Inject the react-native-maps plugin with the Android API key.
  // The plugin writes com.google.android.geo.API_KEY into AndroidManifest.xml
  // at prebuild time. Set GOOGLE_MAPS_ANDROID_API_KEY in .env (never commit it).
  // Create the key at: https://console.cloud.google.com/
  //   Enable: "Maps SDK for Android"
  //   Restrict by package name: com.bounswe2026group11.socialeventmapper
  const existingPlugins = (config.plugins ?? []).filter(
    (p) => {
      const name = Array.isArray(p) ? p[0] : p;
      return name !== 'react-native-maps';
    },
  );

  return {
    ...config,
    plugins: [
      ...existingPlugins,
      ['react-native-maps', { androidGoogleMapsApiKey: androidMapsKey }],
    ],
  };
};
