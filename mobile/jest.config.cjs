/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Must run before React (or react-test-renderer) is first loaded.
  setupFiles: ['<rootDir>/jest/setup-react-act.cjs'],
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    // Must come before the generic '^@/(.*)$' catch-all so Jest uses the
    // lightweight mock instead of the real ThemeContext when components call
    // useTheme() inside unit tests.
    '^@/theme$': '<rootDir>/jest/mocks/theme.js',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native$': '<rootDir>/jest/mocks/react-native.js',
    '^expo-file-system$': '<rootDir>/jest/mocks/expo-file-system.js',
    '^expo-document-picker$': '<rootDir>/jest/mocks/expo-document-picker.js',
    '^expo-file-system/legacy$': '<rootDir>/jest/mocks/expo-file-system-legacy.js',
    '^expo-image-picker$': '<rootDir>/jest/mocks/expo-image-picker.js',
    '^expo-image-manipulator$': '<rootDir>/jest/mocks/expo-image-manipulator.js',
    '^expo-location$': '<rootDir>/jest/mocks/expo-location.js',
    '^expo-secure-store$': '<rootDir>/jest/mocks/expo-secure-store.js',
    '^react-native-svg$': '<rootDir>/jest/mocks/react-native-svg.js',
    '^@react-native-firebase/app$': '<rootDir>/jest/mocks/react-native-firebase-app.js',
    '^@react-native-firebase/messaging$':
      '<rootDir>/jest/mocks/react-native-firebase-messaging.js',
    '^expo-router$': '<rootDir>/jest/mocks/expo-router.js',
    '^react-native-maps$': '<rootDir>/jest/mocks/react-native-maps.js',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  clearMocks: true,
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          module: 'commonjs',
          esModuleInterop: true,
          strict: true,
        },
      },
    ],
  },
};
