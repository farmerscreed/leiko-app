# Startup hang fix — "the app just keeps loading" (2026-10-27)

Branch: `fix/startup-never-hangs` (local only, not pushed yet).

## Symptom (founder report)

On launch the app often sits on the spinner indefinitely; nothing
happens. Worse on airport / hotel Wi-Fi and weak mobile data.

## Root cause (two defects, both in the launch path)

1. **No timeout anywhere.** React Native's Android HTTP stack (OkHttp)
   is configured with no connect/read timeout. A stalled request — a
   captive portal, a dropped TCP session — never settles.
2. **No failure branch.** `RootNavigator` shows the spinner while
   `useAuth.status === 'loading'`. `hydrate()` awaited `getSession()`
   (which needs the network to refresh an access token older than an
   hour — i.e. almost every cold start) and then `fetchProfile()`. If
   either threw, the error was swallowed by `void hydrate()` and
   `status` stayed `'loading'` forever. If either hung, same result.

So any network trouble at launch = permanent spinner, which violated
the CLAUDE.md rule "the app must function with no network".

Server side was ruled out: prod (`kqnzxjrpnjnczhgdwdqg`) is
ACTIVE_HEALTHY, and edge logs on 2026-10-27 show the phone's launch
chain (token → users → get_user_onboarding_state) completing in
~100–750 ms per call when the connection holds.

## Fix

- `services/fetchWithTimeout.ts` — global fetch for the Supabase client,
  60 s cap (generous because PDF generation and Ask Leiko run through
  edge functions). Caller abort signals still work.
- `utils/withTimeout.ts` — promise deadline helper.
- `state/auth.ts`
  - Each launch step (`getSession`, `fetchProfile`,
    `checkOnboardingState`) has a 10 s deadline (`STARTUP_TIMEOUT_MS`).
  - The profile is saved to encrypted MMKV
    (`STORAGE_KEYS.cachedProfile`) on every successful fetch and cleared
    on sign-out / signed-out session.
  - Offline launch with a saved profile for the same user → opens
    normally (`authenticated`); supabase-js keeps refreshing in the
    background and `onAuthStateChange` swaps in the fresh session.
  - Offline launch with no saved profile → new status `'offline'`.
  - No stored session at all → `unauthenticated` (no network needed).
  - The auth listener is registered first and only once, so a late
    refresh moves the app on without a tap, and Retry never stacks
    listeners.
- `navigation/RootNavigator.tsx` — `'offline'` renders a calm
  `ErrorState`: "We can't reach Leiko right now. / Check your internet
  connection, then try again. Your readings are safe on this phone." +
  Try again (re-runs `hydrate()`).

Note: the saved profile only exists after one successful launch on the
new build, so the very first launch after updating still needs the
network once (it then shows Try again instead of hanging).

## Verification

- New: `state/__tests__/auth.startup.test.ts` (9) and
  `services/__tests__/fetchWithTimeout.test.ts` (6). All 9 startup tests
  FAIL against the previous `auth.ts` and pass with the fix.
- Full suite: 246 suites / 2840 tests green. `tsc --noEmit` clean.
  eslint clean on touched files. copy-lint 0 hard.
- On-device: pending — build a release APK/AAB and test cold start with
  Wi-Fi off, and on the airport network.

## Next

1. On-device check (above), then push + PR to main.
2. Ship via Play Internal testing (a local APK cannot update the Play
   copy — signatures differ; see d13-program-status.md).
