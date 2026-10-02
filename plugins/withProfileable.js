// Marks the Android app <profileable android:shell="true"/> so CPU profilers (simpleperf,
// Perfetto) can sample a release build. Opt-in: only when EXPO_PROFILEABLE=1 at prebuild,
// so store builds are unchanged.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withProfileable(config) {
  if (process.env.EXPO_PROFILEABLE !== '1') return config;
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) app.profileable = [{ $: { 'android:shell': 'true' } }];
    return cfg;
  });
};
