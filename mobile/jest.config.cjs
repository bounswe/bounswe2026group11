/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Must run before React (or react-test-renderer) is first loaded.
  setupFiles: ['<rootDir>/jest/setup-react-act.cjs'],
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native$': '<rootDir>/jest/mocks/react-native.js',
    '^expo-image-picker$': '<rootDir>/jest/mocks/expo-image-picker.js',
    '^expo-image-manipulator$': '<rootDir>/jest/mocks/expo-image-manipulator.js',
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
