import { Config } from "@remotion/cli/config";

export const config: Config = {
  // Match the MyComposition defaults (1920×1080 @ 30fps)
  defaultProps: {},
  concurrency: 4,
  // Allow longer compositions for full voiceover renders
  maxDurationInFrames: 3000,
  // Where bundled assets land
  webpackOverride: (currentConfiguration) => {
    return {
      ...currentConfiguration,
      resolve: {
        ...currentConfiguration.resolve,
        alias: {
          ...currentConfiguration.resolve?.alias,
          // Ensure theme.ts is resolvable from any depth
          "@theme": require.resolve("./src/theme"),
        },
      },
    };
  },
};

export default config;
