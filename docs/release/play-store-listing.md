# Google Play — store listing copy (Leiko)

Paste-ready copy for Play Console → **Main store listing**. Every string was
written through `docs/05-voice-and-claims.md` and the regulatory "can/can't
say" rules in `docs/marketing/leiko-ads-playbook.md` §15.3.

**Regulatory guardrails baked in (do not edit these out):**
- Generic regulatory standing only — **never** the maker name, the FDA
  establishment / 510(k) numbers, or any EUDAMED/UDI/verifiable link.
- "FDA-listed Class II", "EU MDR Class IIa", "built in an ISO 13485 facility".
  Never "FDA-approved", "FDA-cleared for treatment", "diagnostic device".
- No `diagnose / treat / cure / predict / prevent`, no fear language, no
  outcome promises, no "patient", no "smartwatch" as the product noun, SpO₂ is
  a "wellness oxygen estimate" (never medical-grade), BP is on-demand (never
  "continuous").

---

## App title  (max 30 chars)

```
Leiko: Blood Pressure & Care
```
*(28 chars. Sentence-case alt if you prefer stricter brand alignment:
`Leiko: Blood pressure & care`.)*

## Short description  (max 80 chars)

```
Blood pressure, heart rate, sleep & activity — for you or someone you care for.
```
*(79 chars.)*

## Full description  (max 4000 chars)

```
Leiko shows your blood pressure — and the rest of your day — in a way the whole family can follow, whether you're tracking your own health or watching over someone you care for.

Leiko pairs with the Leiko watch: a rare wrist device that measures blood pressure with a real inflating cuff — the same oscillometric method as the cuff at your doctor's office. So the numbers are ones you can actually trust, not an estimate from your pulse.

What you can see and do
• Your everyday numbers, together — blood pressure, heart rate, a wellness oxygen estimate, sleep, and daily activity, in one calm view.
• Patterns, explained — Leiko quietly connects your readings to the rest of your day, in plain language: "Your evening readings have been a little higher than your mornings this week."
• Your family, close by — invite up to five people to your family circle so the people who care can see how you're doing, even from another city or country. You stay in control of who sees what.
• For your doctor — turn weeks of readings into a clean, shareable PDF to bring to your next appointment, instead of trying to remember last Tuesday.
• Ask Leiko — ask plain-English questions about your readings and get a calm, clear answer.

Built on a real medical device
The Leiko watch is an FDA-listed Class II blood-pressure device, classified EU MDR Class IIa, and built in a facility certified to ISO 13485 — the international standard for medical-device manufacturing. Most wrist blood-pressure devices estimate from your pulse. Leiko measures, with a real cuff.

Leiko Plus (optional)
A subscription (US$4.99/month or US$39.99/year) unlocks your full trends history, the richer "For your doctor" report, a higher Ask Leiko allowance, weekly summaries, and quiet notices when a reading is worth a second look. Leiko works without it — Plus is there when you want more.

Please note
Leiko is a companion to the Leiko watch, which is sold separately (leiko.health). Without the watch, there's nothing to pair with yet.

Your data is yours
Your readings are encrypted in transit and on your device, you choose who in your family can see them, and you can delete your account and all your data at any time from Settings.

Leiko helps you see your numbers and share them with the people who matter — it doesn't replace your doctor. Talk to your doctor about what your readings mean for you.
```

---

## Other store-listing fields

| Field | Value |
|---|---|
| **App category** | **Health & Fitness** (recommended — broad reach, standard review). "Medical" is defensible given the device pairing but draws stricter scrutiny; Health & Fitness is the safer first listing. |
| **Tags** | blood pressure, heart rate, health, family, caregiving |
| **Contact email** | `support@leiko.app` (or the founder's monitored inbox) |
| **Website** | `https://leiko.health` |
| **Privacy policy URL** | **REQUIRED — must be hosted before submission** (e.g. `https://leiko.health/privacy`). Health apps cannot publish without it. (= OPS-10 in `PRODUCTION_READINESS.md`.) |

## Graphic assets required (Play Console blocks submission without these)

| Asset | Spec |
|---|---|
| App icon | 512×512 PNG, 32-bit |
| Feature graphic | 1024×500 PNG/JPG (no alpha) |
| Phone screenshots | 2–8, 16:9 or 9:16, min 320px side. Use real app screens — the constellation home, a vital detail, Trends, "For your doctor", the family circle. **No red, no fear imagery, no outcome before/after** (playbook §3 visual rules). |
| (optional) Tablet / 7"/10" screenshots | only if you declare tablet support |

---

## Voice/compliance self-check (run before publishing — playbook §15.2)

```
[ ] No "patient" / "user" / "loved one"
[ ] No "diagnose / treat / cure / predict / prevent" (disease)
[ ] No "smartwatch" as the product noun
[ ] No "continuous blood pressure", no "medical-grade SpO2"
[ ] No "dangerous/critical level", no fear language
[ ] No outcome promises ("lower your BP", "live longer")
[ ] FDA / EU / ISO stated generically — NO numbers, NO maker, NO links
[ ] "Talk to your doctor" present; "doesn't replace your doctor" present
[ ] No red / no fear imagery in the screenshots + feature graphic
```

*This listing copy passes all of the above. Re-run the check after any edit.*
