# Start here — Sprint 19 close-out + next session (2026-05-24)

Last touched: 2026-05-24 evening. Branch `claude/competent-goldberg-737194`,
tip `5f6d8e3`. Pushed to origin. Supersedes the 2026-05-22 handoff.

## 60-second context

Sprint 19 shipped **Blocks 1-10** (multi-account + caregiver model + auth
hardening + doctor PDF polish + PDFShift adapter fix) across 13 commits
on top of v5. v6 APK is on Phone 1 already; **v7 has NOT been built** —
needs to be kicked next session.

## What's working RIGHT NOW (no further action)

- ✅ All Sprint 19 source on origin at `5f6d8e3`
- ✅ Migration `0024_caregiver_relationship_label.sql` applied to prod
- ✅ `generate-doctor-pdf` Edge Function deployed (with PDFShift Basic-auth fix)
- ✅ `accept-family-invite` Edge Function deployed (with relationship-label column)
- ✅ Lawrence's family (`21b057bb-…`) set to `subscription_status = 'plus'` in prod
- ✅ Doctor PDF can now generate on v6 — visuals from Block 10 land via the
  deployed Edge Function (mobile didn't need a rebuild for the template work)
- ✅ Sprint 19 sprint card lives at `plans/sprint-19-multi-account-caregiver-model.md`

## What blocks v7 ship

1. **Build v7 APK.** Branch tip `5f6d8e3`. EAS will auto-bump to versionCode 10
   or higher. Command from `apps/mobile/`:

   ```
   $env:NODE_OPTIONS = '--dns-result-order=ipv4first'  # avoids the v6-cycle GraphQL flakes
   npx --yes eas-cli@latest build --platform android --profile production-apk --non-interactive --no-wait
   ```

   v7 carries:
   - **Block 1** SELF-label hidden + invite owner-gate (cosmetic v6 → v7 parity)
   - **Block 2** Care-for-another-person + chooser sheet
   - **Block 3** Edit-family-details sheet
   - **Block 4** Account switcher + delete-account confirm
   - **Block 5** Per-caregiver relationship label (chip on AcceptInviteSheet)
   - **Block 7** APP_VERSION reads from app.json; leiko.health URLs
   - **Block 8** ⭐ Fresh-install onboarding-redirect fix
     (returning users on a clean device skip onboarding)
   - **Block 9** Account-switch routes to OTPVerify; friendly SignIn errors;
     self-buyer "Add a watch later" card; OTP welcome + digit count +
     use-a-different-email link; persona breadcrumb on form screens
   - **Block 10** (template lives in source but server already deployed) —
     SVG charts + Halo Ember letterhead + colour-coded sections

2. **`generate-doctor-prep-ai` is returning 502.** Edge Function CRASHES at boot
   or in handler (the request log shows `EDGE_FUNCTION_ERROR` with content-length
   75). Next session: pull the function's own error event from
   `https://supabase.com/dashboard/project/kqnzxjrpnjnczhgdwdqg/functions/generate-doctor-prep-ai/logs`
   and paste the FULL `event_message` (not just the request status). Likely
   suspects:
   - Anthropic key format issue (`ANTHROPIC_API_KEY` is set per secrets list,
     but the value may be wrong shape — should start with `sk-ant-`)
   - Tier-C cascade path crashing because `AI_TIER_C_PROD_DATA_ENABLED` is set
     but a dependency isn't (embedding cache / token counter / etc.)
   - Output-guard Layer 2 cosine check failing on cold start
   
   **Non-blocking for PDF generation** — `generate-doctor-pdf` gracefully
   degrades when prep-ai 502s (just renders data-only sections, no AI cover or
   cross-vital observations paragraph). Phone 1 should be getting a working
   PDF right now.

## What's still pending after v7

| Item | Owner | Notes |
|---|---|---|
| `RESEND_FROM_EMAIL` Supabase secret | Founder | Once leiko.health DNS verifies at Resend, set to `noreply@leiko.health`. Until then, family invites generate codes but skip the email send. |
| `REVENUECAT_WEBHOOK_SECRET` + RC dashboard setup | Founder | Block 6.x launch readiness. Required before real Plus purchases work. |
| Apple/Play IAP products (`com.leiko.app.plus.monthly` + `.annual`) | Founder | App Store Connect + Play Console, 24-72h approval |
| iOS prebuild + APNs/FCM (needs Mac) | Founder | Block 6.1 |
| Website `leiko.health/{terms,privacy,support}` | Website agent | Block 6.4. Prompt given founder 2026-05-23. |
| Prep-ai 502 diagnosis | Next session | Pull error event + patch. |
| Sprint 18 sleep wake-time on-device verification | Founder | Carried from Sprint 18; never ran the test plan on Phone 1 with real watch overnight. |
| 28 stale snapshot tests (Sprint 16.6 palette drift) | Cleanup sprint | Pre-existing; not blocking CI per se but noisy. |

## Bench state (carried forward)

- **Phone 1** (Pixel 8, `43230DLJH001YY`) — APK v6 installed; signed in as
  `lawonecloud@gmail.com` (account_type `self_buyer`, Plus tier). Lawrence's
  family has 51 BP readings. PDFShift quota check pending.
- **Phone 2** (OnePlus Nord N30, `8fae80bc`) — not touched recently.
- **Test accounts**:
  - `lawonecloud@gmail.com` — self_buyer, family_owner of Lawrence (`21b057bb-…`)
  - `lawonelimited@gmail.com` — self_buyer, family_owner of TheOne (`b14f53e6-…`) — stale test data
  - `btamunokiri@hotmail.com` — caregiver, member of TheOne (`b14f53e6-…`)
- **Lawrence family is Plus**; the other two are Free.

## Sprint 19 commits (this session, oldest → newest)

```
2fdd6ed  fix(caregiver): hide SELF relationship leakage + gate invite on owner role  (Block 1)
23572c2  feat(caregiver): add 'Care for another person' flow + action-bar chooser    (Block 2)
38907ea  feat(family): owner edit-family-details from Settings → Family              (Block 3)
d3becf7  feat(auth): account switcher — remember signed-in emails on this device      (Block 4)
0105560  feat(family): per-caregiver relationship label (Sprint 19 Block 5)          (Block 5)
0cf5c12  docs(launch): record v6 APK build queued                                    (Block 6)
8467df3  docs(launch): record v6 APK URL                                             (Block 6)
9cfa14f  fix(auth): derive onboarding-complete from server, not per-device MMKV      (Block 8)
3427df6  fix(auth+onboarding): account-switch routing + 6 other hardening items      (Block 9)
957c986  feat(doctor-pdf): inline SVG charts + branded letterhead + colour sections  (Block 10)
5f6d8e3  fix(doctor-pdf): adapt rasterizer auth + body shape per vendor (PDFShift)   (Block 10 follow-up)
ed0179f  fix(settings): real app version + leiko.health URLs                         (Block 7)
b8efa12  docs(launch): record v6 APK URL stub
d05639a  docs(launch): record v6 APK build queued
```

## Resend domain setup (founder TODO)

Verified leiko.health DNS records at Resend:
- `MX send → feedback-smtp.us-east-1.amazonses.com priority 10`
- `TXT send → v=spf1 include:amazonses.com ~all`
- `TXT resend._domainkey → (DKIM key from dashboard)`
- `TXT _dmarc → v=DMARC1; p=none;` (optional, recommended)

Once verified in Resend dashboard → set `RESEND_FROM_EMAIL=noreply@leiko.health`
in Supabase secrets → redeploy `send-family-invite`.

## Hard rules carried forward

1. **`expo prebuild` stomps three Android customizations** — see
   `memory/expo_prebuild_android_drift.md`. Never run prebuild during
   manual icon / asset baking.
2. **`account_type` is immutable**. Account switcher does NOT change
   account_type — it signs out + signs in a different user.
3. **`accept-family-invite` writes the per-caregiver label** to
   `family_members.caregiver_relationship_label` (migration 0024).
   Display layer prefers per-caregiver label over family default;
   formatRelation('self') → 'Wearer' as the safety-net fallback.
4. **Doctor PDF AI prep is best-effort** — `generate-doctor-pdf`
   degrades to data-only when prep-ai 502s. Don't bake AI as a hard
   dependency.
5. **PDFShift uses HTTP Basic auth** (API key as username, empty
   password), NOT Bearer. `rasterizer.ts` adapter handles this; do
   not regress the Browserless code path.

## Memory close-out from this session

Worth adding once memory tool is back online:

- Sprint 19 close-out across Blocks 1-10
- PDFShift vendor adapter pattern (Basic auth + `source` field, not Bearer + `html`)
- Block 8 onboarding-derive-from-server pattern (`checkOnboardingState` query)

## Open prompt for the next session

> Sprint 19 ready to ship as v7. Branch tip `5f6d8e3`. Read CLAUDE.md +
> `plans/NEXT_SESSION_START_HERE.md` + the Sprint 19 sprint card.
>
> Two work items in order:
> 1. **Kick v7 APK build** via `npx eas-cli@latest build --platform android
>    --profile production-apk --non-interactive --no-wait` from
>    `apps/mobile/`. If GraphQL flakes (intermittent api.expo.dev issue
>    seen 2026-05-22/23), set `NODE_OPTIONS=--dns-result-order=ipv4first`
>    and retry. Update `plans/LAUNCH_ARTIFACTS.md` with the URL.
> 2. **Diagnose prep-ai 502.** Open
>    `https://supabase.com/dashboard/project/kqnzxjrpnjnczhgdwdqg/functions/generate-doctor-prep-ai/logs`
>    and pull the actual `event_message` for the most recent crash. Patch
>    the cause. Re-test by tapping Generate PDF on Phone 1 → confirm AI
>    cover + observations paragraphs land on the rendered PDF.
>
> After both: hand off to founder for Phone 1 install + retest.
