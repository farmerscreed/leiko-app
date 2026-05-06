// Runs after jest-expo's preset setup, which requires `expo/src/winter` and
// installs lazy getters via defineLazyObjectProperty. Those getters self-
// replace with cached values on first access — so touching them here forces
// eager evaluation. Without this, jest tears down the test environment, then
// something (jest internals, RN cleanup, fast-refresh hooks) reads
// __ExpoImportMetaRegistry, the lazy getter fires `require()`, and jest-
// runtime throws "outside the scope of the test code" because
// `isInsideTestCode === false`. See memory/jest_expo_deferred.md.

void globalThis.__ExpoImportMetaRegistry;
void globalThis.URLSearchParams;
void globalThis.structuredClone;
