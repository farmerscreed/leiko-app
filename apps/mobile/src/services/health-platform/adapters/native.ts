// Cross-platform fallback. Metro picks native.ios.ts on iOS and
// native.android.ts on Android; this file is what every other resolver
// (Jest, web, the type-checker before bundling) sees. We re-export the
// mock adapter under the names the public surface imports so type-only
// builds and Jest both compile against the same shape the native
// adapters do.

export { mockAdapter as nativeAdapter } from './mock';
