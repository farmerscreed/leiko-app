// Learn more https://docs.expo.io/guides/customizing-metro
//
// Monorepo-CWD trap (per memory `expo_monorepo_cwd.md`): by default
// Expo's @expo/metro-config inflates Metro's serverRoot up to the
// workspace root because of the workspaces entry in
// kena-app/package.json. The dev-client then requests
// /.expo/.virtual-metro-entry.bundle relative to the workspace root,
// AppEntry.js resolves `../../App` from <workspaceRoot>/node_modules/
// expo/AppEntry.js → <workspaceRoot>/App.tsx → doesn't exist →
// red-screen UnableToResolveError.
//
// Fix: set `EXPO_NO_METRO_WORKSPACE_ROOT=1` when starting Metro (see
// scripts/dev-metro-start.ps1 / the .env approach below). Expo's
// `getMetroServerRoot` then returns projectRoot instead of walking
// up to the workspace. Bundle URLs resolve from apps/mobile/ directly
// — no URL rewriting needed.
//
// We still pin projectRoot + watchFolders explicitly so Metro stays
// rooted here regardless of which directory the CLI was launched
// from. watchFolders adds the repo root only as an additional
// watcher (so workspace-hoisted deps resolve), not as the project
// root.

const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Explicit pin overrides any wrapper that tries to relocate the root.
config.projectRoot = projectRoot;
config.watchFolders = [projectRoot, workspaceRoot];
// Resolve node_modules from BOTH the package and the workspace root
// so hoisted deps (when npm hoists) still load.
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, 'node_modules'),
  path.join(workspaceRoot, 'node_modules'),
];

module.exports = config;
