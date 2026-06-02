// App entry. Sprint 18 / SEC-1 — async boot orchestrator.
//
// Boot order:
//   1. useFonts kicks off in parallel with secureBoot.acquireMmkvKey().
//   2. If migration is pending (existing install pre-SEC-1), run the
//      legacy → encrypted MMKV copy. On crash: fall back to legacy
//      plain MMKV for this session, log, retry next cold-start.
//   3. Once boot + fonts are ready, DYNAMIC-IMPORT PostBootShell.
//      That import is what transitively loads services/storage.ts,
//      so it MUST happen after acquireMmkvKey resolves.
//   4. Emit telemetry (logger import is also deferred — it depends on
//      storage and would otherwise race the key acquisition).
//
// Until the shell is loaded, `return null` keeps the Expo native splash
// visible. Per recommendation (4) we accept the unstyled splash window
// rather than introduce a separate themed BootSplash that touches mmkv.
//
// Three runtime modes are routed inside PostBootShell:
//   1. DEV gallery (EXPO_PUBLIC_DEV_GALLERY=true)
//   2. DEV real flow (default in __DEV__)
//   3. Production
//
// Wrapping order matters and lives inside PostBootShell:
//   GestureHandlerRootView → SafeAreaProvider → ThemeProvider → RootNavigator
//
// Observability: initSentry() runs at module load, BEFORE any other
// component evaluates, so a render-side crash in PostBootShell still
// reaches Sentry. wrapWithSentry on the exported default catches
// uncaught errors that bubble past component boundaries. Both no-op
// when EXPO_PUBLIC_SENTRY_DSN isn't set in the build env.

import { useEffect, useState, type ComponentType } from 'react';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_600SemiBold_Italic,
  Inter_700Bold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import {
  acquireMmkvKey,
  MIGRATION_ATTEMPT_LIMIT,
  isEncrypted as isSecureBootEncrypted,
} from './src/services/secureBoot';
import {
  deleteLegacyMmkv,
  runMmkvMigration,
  type MigrationResult,
} from './src/services/secureBoot.migrate';
import { initSentry, wrapWithSentry } from './src/services/sentry';

// Initialise Sentry before any other module gets a chance to throw.
// No-ops when EXPO_PUBLIC_SENTRY_DSN isn't set.
initSentry();

function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_600SemiBold_Italic,
    Inter_700Bold,
    Inter_900Black,
    JetBrainsMono_500Medium,
    // Editorial serif (Sprint 7.7 caregiver mode). Used for the
    // greeting headline + person-card editorial sentence.
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });

  // Shell is null while secureBoot + (optional) migration + dynamic
  // import are in flight. After resolution, holds the component
  // PostBootShell exports. setShell with a thunk so React doesn't call
  // the component as the state updater.
  const [Shell, setShell] = useState<ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const boot = await acquireMmkvKey();

      let migrationResult: MigrationResult | null = null;
      let migrationFailReason: string | null = null;

      const shouldMigrate =
        boot.key !== null &&
        boot.migrationStatus === 'pending' &&
        boot.attempts < MIGRATION_ATTEMPT_LIMIT;

      if (shouldMigrate && boot.key) {
        try {
          migrationResult = await runMmkvMigration(boot.key);
          // null result means the attempt counter is at/over the cap;
          // secureBoot.migrate already incremented it. Surface as a
          // distinct telemetry mode below.
        } catch (err) {
          migrationFailReason = err instanceof Error ? err.message : 'unknown';
        }
      }

      // 7-day legacy grace check (per recommendation 1). Deleting on
      // a successful encrypted boot reclaims disk space after the
      // rollback window has closed. Safe no-op if the file is gone.
      let legacyDeleted = false;
      if (
        boot.legacyDeleteAfterMs !== null &&
        Date.now() > boot.legacyDeleteAfterMs &&
        isSecureBootEncrypted()
      ) {
        try {
          deleteLegacyMmkv();
          legacyDeleted = true;
        } catch {
          /* file gone or unwritable — not fatal */
        }
      }

      // Dynamic import: PostBootShell transitively loads services/storage,
      // which reads getCachedKey() at module evaluation. We MUST reach
      // here only after acquireMmkvKey resolved (it has, above).
      const mod = await import('./src/app/PostBootShell');
      if (cancelled) return;
      setShell(() => mod.default);

      // Telemetry — deferred import so logger sees the right storage
      // instance (encrypted if migration completed, legacy otherwise).
      void emitBootTelemetry({
        boot,
        migrationResult,
        migrationFailReason,
        legacyDeleted,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // While EITHER fonts or boot is pending, return null so the Expo
  // native splash stays visible. Font-load errors fall through so a
  // transient asset failure doesn't brick the app.
  if (!fontsLoaded && !fontError) return null;
  if (!Shell) return null;

  return <Shell />;
}

async function emitBootTelemetry(args: {
  boot: Awaited<ReturnType<typeof acquireMmkvKey>>;
  migrationResult: MigrationResult | null;
  migrationFailReason: string | null;
  legacyDeleted: boolean;
}): Promise<void> {
  try {
    const { track } = await import('./src/services/analytics/logger');
    const { boot, migrationResult, migrationFailReason, legacyDeleted } = args;
    track('sec1_boot_completed', {
      encrypted: isSecureBootEncrypted(),
      status: boot.migrationStatus,
      attempts: migrationResult?.attempt ?? boot.attempts,
      migrationDurationMs: migrationResult?.durationMs ?? 0,
      keysCopied: migrationResult?.keysCopied ?? 0,
    });
    if (migrationFailReason) {
      track('sec1_migration_failed', {
        mode: 'copy',
        attempt: boot.attempts + 1,
        reason: migrationFailReason,
      });
    } else if (
      boot.migrationStatus === 'pending' &&
      boot.attempts >= MIGRATION_ATTEMPT_LIMIT
    ) {
      track('sec1_migration_failed', {
        mode: 'limit_reached',
        attempt: boot.attempts,
        reason: 'attempt_cap_reached',
      });
    } else if (boot.migrationStatus === 'failed') {
      track('sec1_migration_failed', {
        mode: 'keychain',
        attempt: 0,
        reason: 'secure_store_unavailable',
      });
    }
    if (legacyDeleted) {
      track('sec1_legacy_deleted');
    }
  } catch {
    /* telemetry must never crash the app */
  }
}

// Wrap the root so any render-side crash becomes a Sentry event. The
// wrap is a no-op when initSentry() short-circuited on a missing DSN.
export default wrapWithSentry(App);
