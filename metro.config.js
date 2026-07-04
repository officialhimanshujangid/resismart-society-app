const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// React Native Reanimated 4+ depends on react-native-worklets
// which uses private properties that Hermes does not support untransformed.
const defaultIgnore = config.transformer.transformIgnorePatterns || [];

config.transformer.transformIgnorePatterns = [
  'node_modules/(?!(?:react-native-worklets|react-native-reanimated|@react-native|react-native)/)'
];

module.exports = config;
