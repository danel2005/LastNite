const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch all files in the monorepo
config.watchFolders = [workspaceRoot]

// Resolve modules from workspace root too (for packages/*).
// Root node_modules first so hoisted packages are found.
config.resolver.nodeModulesPaths = [
  path.resolve(workspaceRoot, 'node_modules'),
  path.resolve(projectRoot, 'node_modules'),
]

// Prevent Metro from climbing above the workspace root when resolving modules.
// This stops it from treating the monorepo root as the Expo project root.
config.resolver.disableHierarchicalLookup = true

module.exports = config
