module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated/plugin must be the LAST plugin so its worklet
    // transform sees the final AST after every other plugin has run. See
    // ADR-0004.
    plugins: ['react-native-reanimated/plugin'],
  };
};
