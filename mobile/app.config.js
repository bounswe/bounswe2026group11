// app.config.js extends app.json and injects secrets that must not be committed.
// Expo reads this file automatically when it is present alongside app.json.
// @ts-check

const { withPodfile, withPodfileProperties } = require('@expo/config-plugins');

const rnFirebaseStaticFrameworkLine = '$RNFirebaseAsStaticFramework = true';
const expoConstantsScriptPatchFunctionName =
  'patch_expo_constants_script_phase_for_spaces';
const alignPodDeploymentTargetsDef = `
def align_pod_deployment_targets(installer)
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      deployment_target = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
      if deployment_target.nil? || deployment_target.to_f < 15.1
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
      end
    end
  end
end`;

const expoConstantsScriptPatchFunction = `
def ${expoConstantsScriptPatchFunctionName}(installer)
  installer.pods_project.targets.each do |target|
    next unless target.name == 'EXConstants'

    target.shell_script_build_phases.each do |phase|
      next unless phase.name == '[CP-User] Generate app.config for prebuilt Constants.manifest'

      phase.shell_script = 'bash -l "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"'
    end
  end
end
${alignPodDeploymentTargetsDef}
`;

const withIosPodBuildSettings = (config) =>
  withPodfileProperties(config, (config) => {
    config.modResults['ios.buildReactNativeFromSource'] = 'true';
    config.modResults['ios.useFrameworks'] = 'static';
    return config;
  });

const withRnFirebaseStaticFramework = (config) =>
  withPodfile(config, (config) => {
    let { contents } = config.modResults;
    if (contents.includes(rnFirebaseStaticFrameworkLine)) {
      config.modResults.contents = contents;
    } else {
      const envUseFrameworksLine =
        "  use_frameworks! :linkage => ENV['USE_FRAMEWORKS'].to_sym if ENV['USE_FRAMEWORKS']\n";
      const lineToInsert = `\n  ${rnFirebaseStaticFrameworkLine}\n`;

      if (contents.includes(envUseFrameworksLine)) {
        contents = contents.replace(
          envUseFrameworksLine,
          `${envUseFrameworksLine}${lineToInsert}`,
        );
      } else {
        contents = contents.replace(
          '  use_react_native!',
          `${lineToInsert}\n  use_react_native!`,
        );
      }
    }

    if (!contents.includes(expoConstantsScriptPatchFunctionName)) {
      contents = contents.replace(
        "ENV['EX_DEV_CLIENT_NETWORK_INSPECTOR']",
        `${expoConstantsScriptPatchFunction}\nENV['EX_DEV_CLIENT_NETWORK_INSPECTOR']`,
      );
    } else if (!contents.includes('def align_pod_deployment_targets')) {
      contents = contents.replace(
        "ENV['EX_DEV_CLIENT_NETWORK_INSPECTOR']",
        `${alignPodDeploymentTargetsDef}\nENV['EX_DEV_CLIENT_NETWORK_INSPECTOR']`,
      );
    }

    const postInstallCalls = `    ${expoConstantsScriptPatchFunctionName}(installer)
    align_pod_deployment_targets(installer)
`;
    const postInstallCallLegacy = `    ${expoConstantsScriptPatchFunctionName}(installer)\n`;

    if (!contents.includes('align_pod_deployment_targets(installer)')) {
      if (contents.includes(postInstallCallLegacy)) {
        contents = contents.replace(postInstallCallLegacy, postInstallCalls);
      } else {
        contents = contents.replace(
          '    )\n  end',
          `    )\n\n${postInstallCalls}  end`,
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });

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

  return withRnFirebaseStaticFramework(withIosPodBuildSettings({
    ...config,
    plugins: [
      ...existingPlugins,
      ['react-native-maps', { androidGoogleMapsApiKey: androidMapsKey }],
    ],
  }));
};
