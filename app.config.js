module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    // EAS file variables contain a path on the build worker.
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || config.android?.googleServicesFile,
  },
});
