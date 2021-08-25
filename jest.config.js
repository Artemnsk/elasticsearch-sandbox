module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 60_000,
  globals: {
    'ts-jest': {
      diagnostics: false,
    },
  },
}
