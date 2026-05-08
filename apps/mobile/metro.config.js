// Learn more https://docs.expo.io/guides/customizing-metro
//
// Monorepo-CWD trap (per memory `expo_monorepo_cwd.md`): when the
// `expo` CLI is resolved through the repo-root `node_modules/.bin`
// (npm workspace symlink), Expo's project-root auto-detection walks
// up to the repo root and Metro's serverRoot follows. The dev-client
// APK requests `/index.bundle` (no prefix) but Metro then expects
// `/apps/mobile/index.bundle` → 404 → "Unable to load script".
//
// We pin projectRoot + watchFolders to apps/mobile so Metro is rooted
// here regardless of how the CLI was invoked. watchFolders adds the
// repo root only as an additional watcher (so workspace deps still
// resolve), not as the project root.

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

// Belt-and-braces: even when Expo CLI relocates serverRoot to the
// repo root (which it does despite the projectRoot pin above when
// the binary is resolved through the workspace symlink), rewrite
// inbound requests so the dev-client APK's `/index.bundle` lands at
// `/apps/mobile/index.bundle` where Metro is actually serving.
const REL_PROJECT = path
  .relative(workspaceRoot, projectRoot)
  .replace(/\\/g, '/');
const previousRewrite = config.server?.rewriteRequestUrl;
config.server = {
  ...(config.server ?? {}),
  rewriteRequestUrl(url) {
    const next =
      typeof previousRewrite === 'function' ? previousRewrite(url) : url;
    // Only rewrite root-level bundle/asset requests (don't double-prefix).
    if (
      typeof next === 'string' &&
      !next.startsWith(`/${REL_PROJECT}/`) &&
      (next.startsWith('/index.bundle') ||
        next.startsWith('/index.map') ||
        next.startsWith('/assets/'))
    ) {
      return `/${REL_PROJECT}${next}`;
    }
    return next;
  },
};

module.exports = config;
