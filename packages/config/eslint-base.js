// @ts-check

/** @type {import('eslint').Linter.Config[]} */
const baseConfig = [
  {
    ignores: ['dist/**', 'build/**', '.next/**', '.expo/**', 'node_modules/**'],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
]

module.exports = baseConfig
