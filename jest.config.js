module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30_000,
  globals: {
    'ts-jest': {
      diagnostics: false,
    },
  },
}
