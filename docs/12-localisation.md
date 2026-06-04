# 12 — Localisation

CANONICAL for v1.1+ work. Sourced from D9 §8 (Localisation pipeline + quality gates), D6 §6.4 (Localization Readiness), D8 §9 (Strings & i18n).

> **MVP locale**: English only. Additional locales ship in v1.1 (Yoruba, Igbo, Hausa) and v1.2 (French, Swahili). Architecture must support locale switching from MVP day one even though only one locale is shipped.

---

## 1. Locale phases (D9 §8.1)

| Locale | ISO | Phase | Rationale |
| --- | --- | --- | --- |
| English | `en` | MVP | Primary at launch; covers caregivers in diaspora and all self-buyers initially |
| Yoruba | `yo` | v1.1 (Q3 2026 target) | Largest Nigerian language by parent-side reach in launch market |
| Igbo | `ig` | v1.1 | Second priority for parent-side coverage |
| Hausa | `ha` | v1.1 | Northern Nigeria coverage; reaches markets the others don't |
| French | `fr` | v1.2 | West Africa francophone expansion (Senegal, Côte d'Ivoire, Cameroon) |
| Swahili | `sw` | v1.2 | East Africa expansion (Kenya, Tanzania) |

> Pidgin / Spanish referenced in D6 §6.4 are **not currently in the locked roadmap**. Treat as backlog; raise as ADR if added.

---

## 2. Library + architecture (D7 §2.1 + D8 §9)

- **i18next + react-i18next** (locked in `docs/00-tech-stack.md`).
- **ICU MessageFormat** for date, time, number, currency, plurals, gender.
- All strings externalised in `apps/mobile/src/i18n/{locale}/{namespace}.json`. Hardcoded JSX strings fail the copy-lint string-extraction rule (D6 §6.4 acceptance criterion).
- Notification templates were specified to live in `apps/mobile/src/i18n/notifications/{locale}.ts` (typed function-per-template per `docs/11-push-notifications.md`). ⚠️ **Drift (flagged 2026-06-02):** as shipped, that directory is an empty placeholder (`.gitkeep` only) and notification copy is currently carried in the standard JSON namespaces, not typed per-locale `.ts` template functions. Either the templates land in `notifications/{locale}.ts` as specified, or this rule is amended to the JSON approach — an open cleanup, not yet resolved.
- Consent text lives in `apps/mobile/src/i18n/consent/{locale}-v{n}.md` per D7 §7.6.

### File structure
```
apps/mobile/src/i18n/
├── en/
│   ├── common.json              # buttons, generic labels, errors
│   ├── home.json                # home screen
│   ├── reading.json             # take-reading + reading-detail
│   ├── trends.json
│   ├── settings.json
│   ├── paywall.json
│   ├── learn.json               # Learn module surface chrome
│   └── ai.json                  # assistant prompts, deflection templates
├── yo/                          # same structure
├── ig/
├── ha/
├── notifications/
│   ├── en.ts
│   └── yo.ts ...
├── consent/
│   ├── en-v1.md
│   └── yo-v1.md ...
└── index.ts                     # i18next bootstrap
```

---

## 3. Locale detection (D7 §10.2)

1. **Per-user preference** in Settings (overrides everything).
2. Else: parent's preferred language (when caregiver views parent context).
3. Else: device locale (`expo-localization`).
4. Else: English fallback.

The user can change locale in Settings without an app restart (i18next re-renders).

---

## 4. Translation quality gates (D9 §8.2)

Health-content translation is high-stakes. A mistranslation in the Crisis card could cost a life. The pipeline gates against this.

| Stage | What happens |
| --- | --- |
| 1 — Native-speaker translator | NOT machine translation. Translator must have **health-content experience**. |
| 2 — Bilingual back-translation | A SECOND translator, blind to original, translates target back to English. Compare to source; flag divergences. |
| 3 — Clinical advisor review | Reviews critical-tier strings: tier-interpretation strings (Inline Explainer headers), `numbers-006`, `numbers-007`, `cultural-003`. |
| 4 — Locale freeze | Card content locked at version-and-locale. Updates require re-running stages 1–3 for affected strings. |

**Never auto-translate at runtime via machine translation.** Editorial gates exist for a reason. When a card hasn't been translated to the user's locale, fall back to English with a banner: *"This card is not yet available in {locale_name}. Showing the English version."*

---

## 5. Forbidden-claim linter — multi-locale

Per D6 §6.5 + `docs/05-voice-and-claims.md`: forbidden-claims are localised — "diagnose" in English is "diagnosticar" in Spanish, "doser" / "diagnostiquer" in French, etc. The linter must support a per-locale rule set.

Implementation (Sprint 1 onwards): `tools/copy-lint/rules/{locale}.json` lists per-locale forbidden patterns. Defaults to English; per-locale rule sets are added as locales ship.

> **Multi-locale linter** is deferred to v1.1 (when the first non-English locale ships). At MVP, only English rules are active. Adding a locale = adding a rules file and getting the clinical advisor to bless it.

---

## 6. RTL readiness (D9 §8.3 + D8 §8.4)

Arabic + Hebrew are not in scope at v1.0 or v1.1 but the architecture commits to RTL readiness in component implementation.

- All component layouts use **logical properties** (`start`/`end`) — never physical (`left`/`right`).
- Numerics in body content stay LTR even in RTL locales (per Unicode bidi).
- Reading-tier chips reverse direction in RTL locales.
- Verified at compile time via a layout-mirror Storybook test (D8 §8.4).

---

## 7. Locale-aware Inline Explainer (D9 §8.4)

When the user's device locale resolves to a target the card has not been translated to:
- Fall back to English content.
- Show banner at top of card: *"This card is not yet available in {locale_name}. Showing the English version."*
- Banner includes a *"Notify me when available"* tap target that subscribes the user to a per-locale push.
- **Never** auto-translate at runtime.

---

## 8. Pluralisation & variables (D8 §9.4)

ICU MessageFormat handles plurals natively:

```json
{
  "readings_count": "{count, plural, =0 {No readings yet} =1 {One reading} other {# readings}}",
  "trial_days_left": "{days, plural, =1 {1 day} other {# days}} left in your trial."
}
```

**Variables** in template strings are typed via i18next-typescript bindings. A missing variable in any locale fails the build (D8 §6.1 hard-fail rule: empty translation in any non-English locale at build time).

---

## 9. Consent text versioning (D7 §7.6)

Consent text lives at `apps/mobile/src/i18n/consent/{locale}-v{n}.md`. When the text materially changes:

- Increment `v{n}`.
- Translate the new version per stages 1–4 above.
- App detects user has consented to `v{n-1}` and asks them to re-consent to `v{n}` on next launch.
- Audit log row written: `action='parent.consent_granted'`, `metadata.version='2.0'`.

---

## 10. Open localisation questions
- Pidgin English: include or fall back to English? Defer to v1.1 once we test with target users.
- Locale-specific quiet-hours defaults — currently 22:00–07:00 caregiver-local; flagged for v1.1 review.
- Auto-translate UI chrome (vs cards) at v1.2 with quality flag — non-critical strings could be ML-translated and reviewed; cards stay human-translated only.
