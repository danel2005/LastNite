const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch all files in the monorepo
config.watchFolders = [workspaceRoot]

// Resolve modules from workspace root too (for packages/*)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// Required for Expo Router + monorepo: enables package.json "exports" field
// so that expo-router/entry resolves correctly (especially on web).
config.resolver.unstable_enablePackageExports = true

module.exports = config
