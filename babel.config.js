module.exports = function (api) {
	api.cache(true);
	return {
		presets: ["babel-preset-expo"],
		plugins: [
			"react-native-reanimated/plugin",
		],
	};
};

// This configuration file is for a React Native project using Expo and Babel.
