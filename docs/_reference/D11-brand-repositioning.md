# D11 — Brand Repositioning

> **📎 Historical reference (stamped 2026-06-02).** This is a dated strategy/spec snapshot, kept for context — **not** living spec. For the app's current behaviour see the docs in `docs/00–15`, `docs/04-screens/`, and the decisions in `docs/_adr/`. Where this document and the shipped app disagree, the app + ADRs win.

**Apple-of-Healthcare · Leiko · LawOne Cloud LLC**
*Prepared: 2026-05-07 · Status: Draft for founder sign-off · Supersedes D5*

---

## Document Metadata

| Field | Value |
|---|---|
| **Deliverable** | D11 — Brand Repositioning |
| **Project** | Leiko health-wearable platform |
| **Entity** | LawOne Cloud LLC |
| **Predecessor docs** | D1 Competitive · D2 Unit Economics · D3 Regulatory · D4 App Strategy · D5 Brand Brief (now superseded) · D6 GTM (will require update) · D7 Supply Chain · D8 Design System (will be superseded by D12) · D8a Self-Buyer Mode · D9 Editorial · D10 Implementation Plan |
| **Sister docs** | D12 Visual System v2 · D13 Multi-Vitals Constellation Spec · D14 Ambient AI Architecture |
| **Output standard** | Decided positions, not options. Ambiguity flagged explicitly. Every claim traceable. |
| **Authority** | When D11 conflicts with D5, D11 wins. When D11 conflicts with downstream screen specs (`docs/04-screens/`), the screen specs are updated to consume D11. |

---

## Executive Summary

D5 positioned Leiko as *"the first health-monitoring platform built for caregivers who love from a distance — starting with the Nigerian diaspora."* Visual language: cream-and-navy, calm-warm-dignified, deliberately anti-tech-bro, deliberately anti-Apple. Persona: 38–52 Nigerian-diaspora caregiver who specifically distrusts polished tech aesthetic.

D11 changes four things and preserves the rest.

**Changes.** (1) The visual aesthetic shifts from cream-and-navy calm to dark-canonical Apple-of-Healthcare premium. (2) The persona ladder flattens from caregiver-primary-with-self-buyer-tertiary to **twin-primary** — caregiver and self-buyer co-equal, with the lead flipping by market (Nigeria leads with self-buyer; US/UK leads with caregiver). (3) The voice gains a *premium-precise* modifier on top of the existing calm-warm-dignified rules — the forbidden-claim list is unchanged but the tonal calibration shifts toward confident-concierge. (4) The product surface expands from BP-only to a five-vital constellation with ambient AI narration; the brand reflects that maturity.

**Preserved.** The forbidden-claim list. The dignity-of-the-parent stance. The diaspora-authenticity moat (founder's Nigerian provenance). The brand name LEIKO. The dual-market strategy (Nigeria + US/UK). The subscription-economics architecture. The clinical voice rules.

**Net effect.** Leiko stops competing with Hello Heart and Withings on calm-warm-trust and starts competing with Oura, Whoop, and Apple Fitness on *premium-pulse-for-families*. The diaspora moat survives the move because the founder's authentic-Nigerian provenance is now expressed through positioning and creative, not through cream-and-navy aesthetic restraint.

This document locks the new brand. D12 (Visual System v2) translates this direction into design tokens. D13 + D14 specify the product surface and AI behaviour the brand promises.

---

## §1. New Strategic Position

### 1.1 Strategic position statement (one line)

> **The premium pulse for families managing hypertension across distance — and for the person managing it themselves.**

This sentence is intentionally twin-primary. It speaks to the caregiver ("families managing hypertension across distance") and the self-buyer ("the person managing it themselves") in a single line. The word "pulse" is doing strategic work: it reframes Leiko from a *blood-pressure tracker* into something more ambient — a continuous reading of how someone is, right now, in this moment.

### 1.2 Why this position is defensible

Three reasons.

1. **Market white space.** The most premium hypertension-specific apps (Hello Heart, Withings) read calm-clinical, not premium. The most premium quantified-self apps (Whoop, Oura, Levels) don't address hypertension management or family-care use cases at all. *Premium hypertension pulse for families* is an unoccupied position. The competitive matrix in §7 shows this clearly.
2. **Authentic founder provenance.** No US-incumbent or Chinese-OEM-white-label competitor can credibly speak to the Nigerian-diaspora caregiver context. The founder's lived experience — Port Harcourt-based, US-registered entity, sandwich-generation diaspora context — is the moat per D5 §1 and unchanged by D11.
3. **Hardware specificity.** The Urion U16 is one of a small number of genuinely-clinical (oscillometric, real cuff) BP wearables on the market. Premium positioning is supportable because the hardware *is* premium under the surface — clinical-method BP plus continuous HR/SpO2/sleep/activity is a feature stack that justifies the price point.

### 1.3 What we are not

Stating these explicitly because brand drift happens at the edges.

- We are **not a quantified-self optimisation product.** No "biohack," no "performance," no "potential." Leiko is for people managing a real condition, not optimising a baseline.
- We are **not a medical-clinical product.** No "diagnose," no "treat," no "predict disease." See voice rules §3.
- We are **not a fitness app.** Steps and activity are vital context, not the headline product.
- We are **not a generic health tracker.** No undifferentiated dashboard. The hero is hypertension and the people connected to it.
- We are **not surveillance.** The parent retains dignity. The caregiver receives reassurance, not a live feed.

---

## §2. Persona Ladder — Twin-Primary, Market-Mirrored

D5 had three personas (Adaeze primary, Marcus secondary, Self-Buyer tertiary). D11 reorganises into two co-equal primaries with sub-personas per market.

### 2.1 Primary Persona One — The Caregiver

A family member who watches over someone else's health from any distance — across an ocean or across town. Tech-fluent, expects Apple-quality UX. The caregiver buys the watch for their parent or partner; their daily relationship is with the app, not the device.

#### 2.1.1 Sub-persona — Adaeze (US/UK diaspora caregiver)

Lead persona for **US/UK GTM creative.**

| Attribute | Value |
|---|---|
| Age | Early 30s to early 40s (evolved from D5's 38–52) |
| Location | NJ, MD, TX, GA, MA, ON, AB, London, Manchester — the four largest Nigerian-diaspora corridors |
| Career | Nurse, IT, accounting, business owner. Median household income $75K–$140K. Often dual-income with a fellow-diaspora spouse. |
| Family context | One or both parents in Nigeria, aged 60+. At least one parent has hypertension. Sends $200–$2,000/month in remittances; 20–40% of which funds healthcare. |
| Tech behaviour | iPhone-dominant. Uses Whoop, Oura, or Apple Watch personally. 2–4 fintech apps for sending money home. Comfortable with $4.99–$14.99/month subscriptions. |
| Emotional driver | Guilt-relief. Peace-of-mind. Wants to know before being told. |
| Trust triggers | Founder's authentic Nigerian provenance. FDA clearance, visible. Apple-quality UX. Fellow-diaspora testimonials. Pricing transparent in USD. |
| Distrust triggers | Anything generic / Chinese-white-label-feel. Anything that puts the burden on the parent. Anything subscription-aggressive. Anything that looks like it was made for older people. |

The bracket shifted younger from D5. Reason: the Apple-of-Healthcare aesthetic resonates more strongly with the early-30s-to-early-40s slice, and the tech-fluency assumption holds more reliably there. The 45–52 cohort is now a *secondary* segment within Adaeze, not primary.

#### 2.1.2 Sub-persona — Marcus (US Black-American family caregiver)

Secondary in the US market.

| Attribute | Value |
|---|---|
| Age | 40–58 |
| Location | Atlanta, Houston, DC, NYC, Detroit, Chicago, Charlotte |
| Family context | Parent in same city or different state. Parent has hypertension (56% prevalence in Black adults; 72% in 60+ Black adults). |
| Trust sensitivities | Authentic representation in marketing imagery is non-negotiable. 66% of African American consumers are more likely to return to a brand that authentically represents their race and ethnicity (Directions Group). 53% will stop trusting brands that don't show diversity (PM360). |
| Trust triggers | Black families in marketing imagery (real, not stock). Cultural specificity ("church mother," "Big Mama"). |

Unchanged from D5 §1.2 except for the elevation from secondary-overall to secondary-within-caregiver-primary.

### 2.2 Primary Persona Two — The Self-Buyer

A person actively managing their own hypertension (or pre-hypertension) and wanting to understand the condition through good data and ambient context. The self-buyer wears the watch themselves; their daily relationship is with both the watch and the app.

This persona was *tertiary* in D5. D11 elevates it to co-primary because the data demands it: 55% Lagos urban hypertension prevalence (D1) makes the Nigerian-resident self-buyer the largest single segment in the funnel. Treating them as tertiary was a brand-level mistake D5 inherited from the original caregiver-first framing.

#### 2.2.1 Sub-persona — The Nigerian-resident self-buyer

Lead persona for **Nigeria GTM creative.**

| Attribute | Value |
|---|---|
| Age | Mid-30s to early 60s |
| Location | Lagos primary; also Abuja, Port Harcourt, Ibadan, Kano. Urban professional |
| Career | Office workers, professionals, business owners, civil servants. Income above the Nigerian median — Leiko is a premium product locally |
| Health context | Diagnosed hypertension or actively-managing borderline. May already own a manual cuff. Aware of personal stroke/heart-attack risk through community (someone they know has had one). |
| Tech behaviour | Android-dominant (~85% Nigerian market share). WhatsApp-first. Uses Bolt, Chowdeck, Opay, Kuda. Comfortable with subscription models if priced in NGN. |
| Emotional driver | Understanding. Control. *"Stop guessing whether the numbers I see are normal."* |
| Trust triggers | Real Nigerian voices in marketing. NAFDAC registration visible. Local pricing in NGN. WhatsApp-based support. |
| Distrust triggers | Pricing only in USD. Marketing that feels American-imported. Anything that requires constant data connectivity (offline-first matters here). |

#### 2.2.2 Sub-persona — The US/UK self-buyer

Secondary in the US market.

| Attribute | Value |
|---|---|
| Age | Early 30s to early 60s |
| Location | US/UK metropolitan |
| Health context | Newly-diagnosed adult. May have an existing relationship with Apple Health. Often has a primary-care doctor recommending self-monitoring. |
| Tech behaviour | iPhone-dominant. May own an Apple Watch. Familiar with Oura/Whoop premium pricing. Comfortable with $9.99–$14.99/month subscriptions. |
| Emotional driver | Understanding their own condition. Generating data their doctor will use. |
| Trust triggers | FDA clearance prominent. Apple Health integration. Doctor-shareable PDF. Premium build quality. |

### 2.3 Audience Insight Governing Everything

Across all four sub-personas, three constants:

1. **They want premium, not cheap.** Pricing pressure is real but not at the cost of feeling generic.
2. **They want understanding, not data.** The constellation of vitals must produce insight, not a dashboard.
3. **They distrust fear-based health marketing.** *"Silent killer," "before it's too late,"* and similar are eliminated everywhere — see §3.

### 2.4 Emotional Architecture

The voice talks to all four sub-personas with the same emotional grammar. What changes is which proper noun replaces "you / them" in any given creative variant.

The architecture:
- **Recognition** — *"You know that feeling when you haven't heard from Mum in three days."*
- **Reassurance** — *"Now you know how she's doing, every day. No phone call required."*
- **Dignity** — *"She doesn't have to remember to update you. The watch does."*
- **Confidence** — *"Clinical-method blood pressure. Continuous heart rate. Sleep, oxygen, activity. All in one premium pulse."*
- **Connection** — *"Across the ocean or across the room — you're connected to her health."*

Each persona's creative slots into this same arc with different proper nouns and different lead emotions:

- **Adaeze:** lead emotion = *guilt-relief*. *"You can't be there for breakfast. Now you don't have to be."*
- **Marcus:** lead emotion = *family-presence*. *"Big Mama doesn't carry a phone everywhere. The watch does the calling."*
- **Nigerian self-buyer:** lead emotion = *understanding*. *"Stop guessing what your numbers mean. Start seeing the rhythm."*
- **US self-buyer:** lead emotion = *control*. *"Your doctor will see what you see. Bring data, not anecdotes."*

---

## §3. Voice & Tone Framework

### 3.1 Voice pillars

The four pillars carry forward from D5 and gain a premium modifier:

1. **Warm.** A friend who happens to be informed, not a clinical authority. Speaks at human eye-level. Calls Mum "Mum," not "the patient."
2. **Calm.** Confident, not anxious. Calm before clever. Never escalates.
3. **Proactive.** Tells the user what they need to know before they think to ask.
4. **Dignified.** The wearer is a parent or yourself, never a patient.
5. **Premium-precise.** *(NEW.)* Restrained vocabulary. Specific numbers when they help. Confident quiet when they don't. Reference: an Aesop sales associate who happens to know your blood pressure.

### 3.2 Forbidden words and phrases (unchanged from CLAUDE.md and D5)

- "patient" — use "Mum," "Dad," "your parent," or "you"
- "diagnose," "diagnosis," "diagnostic," "treat," "treatment," "cure"
- "predict," "prevent" (when applied to disease)
- "silent killer," "ticking time bomb," "before it's too late"
- "medical advice" (we don't give it)
- "dangerous level," "critical level"
- Any phrase that promises an outcome ("will lower your BP," "will help you live longer")

### 3.3 New forbidden vocabulary (added by D11)

The premium-precise modifier rules out:

- "Biohack," "biohacking," "optimise" (in the quantified-self sense), "performance," "potential"
- "Crush," "smash," "destroy" — fitness-bro vocabulary
- "Streak," "level up," "achievement unlocked" — gamification vocabulary
- "Insights" used as a synonym for "graphs" — we say "patterns" instead
- "Wellness" — too soft for what we are
- "Smart" applied to features ("smart alerts," "smart insights") — meaningless in 2026

### 3.4 Preferred patterns

- Lead with the answer. First sentence resolves the question. The data point is the first thing.
- Plain language before clinical terms. *"The first number"* before *"systolic."*
- **"Talk to your doctor"** — not *"consult a healthcare provider."*
- Sentence-case headlines. Never UPPERCASE. Never Title Case.
- Names: *"Mum,"* *"Dad,"* *"your parent,"* or the user's chosen label.
- Numbers tabular and unambiguous. *"128 over 82,"* not *"around 130."*
- Time of day in user's local context: *"this morning,"* not *"at 0747 UTC."*

### 3.5 Tone calibration — the Aesop test

When a sentence feels off, run it through this test: *would an Aesop sales associate say this?* If the answer is no — too excited, too clinical, too anxious, too pushy — rewrite. The Aesop sales associate is confident, restrained, kind, never pushy, never gushes. Their compliment about your skin is more credible because they don't oversell it. That is Leiko's voice.

### 3.6 Premium-precise examples

*Bad (current voice in some draft copy):*
> "Mum's blood pressure is doing great today! Looking calm and steady. ✨"

*Good (premium-precise):*
> "Mum is in pattern. 124/79 this morning, six below her week."

*Bad:*
> "Get powerful insights into your cardiovascular health!"

*Good:*
> "See how sleep and activity move your morning numbers."

*Bad:*
> "Track your progress with smart goals and achievements!"

*Good:*
> "Set a target. We'll show you how the week is going."

---

## §4. Brand Name — LEIKO Verdict

### 4.1 Does LEIKO survive the pivot?

Yes. The criteria that selected LEIKO in D5 §2.5 are unchanged and intact:

- Pronounceable by anyone — Nigerian, American, British (LAY-koh)
- Suggests warmth without being literal
- Three letters' visual rhythm — strong app icon
- Evocative without being culturally narrow
- Works as a verb in conversational copy ("Did you check Leiko today?")
- Premium phonetics — strong K, open vowels

What changes under the new positioning is *what LEIKO means.* In D5 it was a calm-warm name for a calm-warm brand. In D11 it's a premium-pulse name for a premium-pulse brand. The phonetics support both readings; the typography and material expression in D12 will tilt the meaning toward premium.

### 4.2 Outstanding verification (carried over from `plans/backlog.md` Q2)

Founder must verify before App Store listing prep:

- USPTO TESS — Class 9 (mobile applications) and Class 10 (medical devices) clearance
- NIPC trademark search — Nigeria
- Domain status — leiko.com, leiko.health, leiko.app
- Apple App Store and Google Play Store name availability
- No conflicting prior use in healthcare, especially pharmaceutical or medical-device sectors
- Phonetic check across Yoruba, Igbo, Hausa, Spanish, French, Mandarin

### 4.3 Logotype direction

D12 will resolve the logotype. D11 sets the direction:

- Sans-serif, geometric-with-warmth (not pure-geometric like Helvetica; not soft-humanist like Avenir)
- Lowercase preferred — *"leiko"* — premium-quiet rather than corporate-loud
- The K is the visual anchor — its diagonal is the brand's silent signature
- Considered references for a designer to study: Aesop wordmark (custom serif, premium restraint), Stripe wordmark (geometric-warm sans), Notion wordmark (geometric, simple, K-anchored letterform). Leiko's logotype should sit comfortably alongside these three.

A word-mark only at v1.0 — no separate symbol/lockup. The K at scale becomes the app icon. This is decided.

---

## §5. Visual Identity Direction (input to D12)

D12 is the document of record for tokens, components, and full system specification. D11 sets the **direction** that D12 will translate.

### 5.1 Aesthetic mood

Dark-canonical, premium-precise, ambient. Cinematic in stillness — a luxury product captured in low light, not a dashboard demo. Subtle motion that suggests the vitals are real, ongoing, *now*. Restraint in color, generosity in typography.

References to study:
- **Highest fit:** Oura Ring app · Whoop · Apple Fitness+ · Apple Health (iOS 18)
- **Tone & polish:** Linear · Arc · Things 3 · Headspace
- **Anti-references:** Hello Heart · Samsung Health · most BP apps on the App Store · generic quantified-self bro aesthetic

### 5.2 Color direction

- **Dark canonical.** Most of the app, most of the time. A deep neutral with character — neither pure black (harsh) nor flat charcoal (forgettable). D12 picks the specific value; the mood is *deep midnight with warmth.*
- **Single signal accent.** One alive accent color used sparingly (≤8% screen area) for primary CTAs, the active vital, the AI narration line. This is *the color of Leiko.* D12 picks; direction is *warm and confident, neither bright nor decorative — feels like a heartbeat.*
- **Vital chromatics.** Each vital's ring/tile may carry a subtle tonal variant, but all five must harmonise into one palette — never a candy-bag of clashing brand colors.
- **State colors.** Functional only — success / calm-concerned / confirmed-urgent. Confirmed-urgent is reserved for clinical-threshold breach; the rest of the app stays calm.
- **Light mode is the variant.** Designed second, never first. Same product in daylight, not a degraded dark.

### 5.3 Typography direction

- **Display face:** premium with character. Recoleta is the placeholder; designer is encouraged to challenge with proposals (Söhne, GT Sectra, Reckless Neue all live in this neighbourhood).
- **Body face:** neutral sans, generous tracking. Inter is acceptable; designer may propose better.
- **Numerics:** tabular figures non-negotiable. JetBrains Mono is current; designer may propose alternatives.
- **Hierarchy:** generous, breathing. Apple Fitness+ rather than Bloomberg Terminal.

### 5.4 Material & depth

- **Glass / translucency** in scope. Subtle frosted layers when content scrolls beneath a hero, when sheets rise, when AI narration appears.
- **Elevation** matters — cards are lifted from the surface, not painted onto it. Tinted shadows on dark surfaces (rim lighting, never pure-black-on-dark — pure black on dark goes muddy).
- **No skeuomorphism.** No analog watch faces, no fake leather, no chrome. The material expression is *digital but tactile.*

### 5.5 Motion direction

The single biggest differentiator from "static health app." We *want* decorative motion, used with restraint. Specifically:

- **Live-pulse.** Active vitals (HR notify streaming) softly pulse at the rhythm of the underlying signal.
- **Ring fill.** Daily Pulse rings fill on first paint with deliberate ease — the *Apple Activity ring moment* — once per session, not on every nav.
- **Reveal choreography.** Home screen vitals reveal in sequence on first open — top-down or center-out — over ~600–900ms total. Once.
- **Sheet rise.** Smooth, weighted, never bouncy. Reference: Apple Health.
- **Reduced motion.** OS-reduce-motion fallback on every effect. Mandatory.

The previous *"decorative motion is forbidden"* rule from D5/D8 is rescinded. The bar is *Apple-tasteful*, not *TikTok-busy*.

### 5.6 Iconography & illustration

- **Iconography:** line-style, single weight, premium feel. Phosphor is acceptable; D12 may propose custom set.
- **Illustration:** minimal. The product itself is the visual.
- **Onboarding hero illustrations:** open question for designer.

### 5.7 Photography (marketing)

- Real people, not stock. Cinematic, low-light, intimate.
- Photography of African and African-American families — Adaeze and Marcus personas need to see themselves.
- The watch appears but never stars. The *moment of care* is the subject.

---

## §6. Messaging Hierarchy

Three-tier hierarchy. Top tier is one line. Second tier is two-three lines per persona-variant. Third tier is the proof points underneath.

### 6.1 Tier 1 — The line

> **The premium pulse for families managing hypertension across distance — and for the person managing it themselves.**

Used on: home page hero, App Store first line, investor deck cover, website above-the-fold.

Short variant for confined spaces (App Store subtitle, Twitter bio):
> **A premium pulse for you and the people you love.**

### 6.2 Tier 2 — Persona-variant headlines

| Persona | Lead headline | Sub-line |
|---|---|---|
| Adaeze | *"Know how Mum is. Without the phone call."* | A clinical-method blood-pressure smartwatch and a beautiful app. Across any distance. |
| Marcus | *"Big Mama doesn't have to remember. The watch does."* | Continuous heart rate, blood pressure, sleep, oxygen — all in one premium pulse. |
| Nigerian self-buyer | *"See the rhythm, not just the number."* | Clinical-method blood pressure, every morning. Plus everything else your body tells you. |
| US self-buyer | *"Bring your doctor data, not anecdotes."* | A clinical-method BP watch, a doctor-ready PDF, a daily pulse. |

These are directional. Marketing creative will iterate.

### 6.3 Tier 3 — Proof points (used everywhere)

- FDA-listed Class II device (specific clearance details per D3)
- Clinical-method oscillometric blood pressure (real micro-cuff, not optical estimation)
- Continuous heart rate, blood oxygen, sleep architecture, steps, calories
- AI-narrated daily pulse — premium ambient health intelligence
- Family-circle sharing — built for distance
- Doctor-ready PDF export
- Apple Health and Health Connect integration
- Premium build, premium price, premium service

---

## §7. Competitive Positioning Matrix

Two axes: *premium ↔ generic* and *hypertension-specific ↔ general health.* Leiko occupies the upper-right quadrant alone.

```
                     PREMIUM
                        │
       Oura ●   Whoop ● │ ● APPLE FITNESS+
                        │
                        │ ● LEIKO  (target position)
       Levels ●         │
                        │
GENERAL HEALTH ─────────┼───────── HYPERTENSION-SPECIFIC
                        │
                        │ ● Withings
                        │
       Fitbit ●         │ ● Hello Heart
                        │ ● Omron
       Samsung Health ● │ ● BP Doctor / generic Amazon
                        │
                     GENERIC
```

**Direct hypertension competitors all sit lower-right:** Hello Heart, Omron Connect, Withings BPM, generic Amazon listings. They compete on FDA-clearance + accuracy + price. They look clinical. They feel medical-utility. None of them is *premium* in the way Whoop or Oura is premium.

**Premium quantified-self competitors all sit upper-left:** Whoop, Oura, Levels, Apple Fitness+. They compete on aesthetic, narrative, and lifestyle. They are not hypertension-specific; they don't ground in clinical-method BP; they don't address the family-care use case at all.

**Apple Fitness+ is the closest neighbour** — premium aesthetic, ring-based home, narrative coaching — but it's optimisation-focused and Apple-Watch-locked, neither of which we are.

**Leiko's position — premium hypertension pulse for families — is unoccupied.** The defensibility comes from three vectors: hardware (clinical-method BP), audience (diaspora caregiver + Nigerian self-buyer), and brand expression (premium-precise rather than calm-clinical or biohack-bro).

---

## §8. GTM Creative Split — Per Market

### 8.1 The flip

Two markets, two lead personas, mirrored creative orders.

| Market | Primary creative track | Secondary creative track |
|---|---|---|
| **Nigeria** | Self-buyer ("see the rhythm") | Caregiver (Nigerian-resident caring for elder) |
| **US/UK** | Caregiver ("know how Mum is") | Self-buyer (newly-diagnosed adult) |

Same product, same brand, same aesthetic, two creative angles per market with the lead order flipped.

### 8.2 Why the flip works

- The *largest single segment* in Nigeria is the resident self-buyer (driven by 55% urban hypertension prevalence in Lagos, D1).
- The *largest single segment* in the US/UK is the diaspora caregiver (driven by NiDCOM 2025 corridor data and the remittance-funded healthcare pattern in D1+D5).
- The same Leiko brand can speak to both leads because the emotional architecture (§2.4) bridges them.
- Cost efficiency: one brand, one product, two creative tracks per market = four creative directions total at scale, not eight.

### 8.3 Channel implications (D6 follow-up)

D6 (Go-To-Market) will need a follow-up update to reslot:

- **Nigeria channels:** WhatsApp marketing, Instagram, in-pharmacy point-of-sale, NHIS-adjacent, faith-community partnerships. Creative leads with self-buyer.
- **US/UK channels:** Instagram (diaspora communities), Facebook (Nigerian-diaspora groups), TikTok (40-something diaspora caregivers), podcast sponsorships in diaspora-relevant shows, church partnerships in major Nigerian-American congregations. Creative leads with caregiver.

This is a follow-up. D11 names the implication; D6 v2 handles execution.

---

## §9. Brand Architecture

Unchanged from D5 §6 except where noted.

- **Parent brand:** LawOne Cloud LLC (US-registered entity, behind-the-scenes).
- **Product brand:** Leiko (consumer-facing).
- **Sub-brands:** Leiko Plus (subscription tier). No further sub-branding planned at v1.0.
- **Hardware co-branding:** Watch is Leiko-branded white-label. Manufacturer (Urion / Shenzhen Urion Technology) is acknowledged in regulatory documentation only — never on consumer packaging or in marketing.
- **App-name = brand-name.** "Leiko" in the App Store and Play Store. No descriptor suffix.

---

## §10. Brand Do's and Don'ts

### 10.1 Do's

- ✓ Show real African and African-American families in marketing imagery.
- ✓ Lead every screen with the answer, not the question.
- ✓ Use generous spacing and large typography. Density via depth, not by cramming.
- ✓ Pulse motion on active vitals — restraint is the bar.
- ✓ Quote founder's authentic Nigerian provenance in the *story* layer (about page, founder letter, podcast appearances). Never as a marketing gimmick.
- ✓ Cite FDA-listing specifically and clearly. Premium positions clear regulatory facts; vague claims are downmarket.
- ✓ Use the Aesop test on every string.

### 10.2 Don'ts

- ✗ Never reproduce the cream-and-navy palette from D5/D8. That brand is gone.
- ✗ Never use red for normal-state UI. Crimson is reserved for confirmed clinical-threshold breach only.
- ✗ Never show count badges, "new" dots, or unread indicators on Learn cards.
- ✗ Never use fear-based push notifications.
- ✗ Never call the wearer a "patient."
- ✗ Never promise an outcome ("will lower your BP," "will help you live longer").
- ✗ Never use gamification language ("streaks," "achievements," "level up").
- ✗ Never use quantified-self optimisation language ("biohack," "performance," "potential," "optimise").
- ✗ Never use exclamation points in body copy. Save them for system messages where the surface is already constrained ("Synced!").
- ✗ Never use stock photography of generic happy seniors.
- ✗ Never localise the visual aesthetic per market — the aesthetic is global; only the creative copy and photography subjects vary.

---

## §11. Brand Application Examples (Direction)

D12 produces the high-fidelity renders. D11 names the surfaces and the direction.

| Surface | Direction |
|---|---|
| App icon | Lowercase k as visual anchor on the brand accent color over deep neutral. Premium-quiet. Reference: Linear icon, Arc icon. |
| App Store screenshots | Five-screen sequence. Lead with Daily Pulse home (Adaeze viewing Mum) for US. Lead with self-buyer Daily Pulse for Nigeria. Each screenshot has a one-sentence overlay in display face — not feature labels, *one-line stories.* |
| Onboarding hero | Photographic, not illustrative. Real family. Low-light. Watch present but not centred. Caption sets emotional context. |
| Paywall | Premium restraint. Three plan tiers in a single card. No exploding confetti. The Aesop sales associate is presenting prices — confident and quiet. |
| Marketing site hero | Above-the-fold: Tier 1 line + a single screenshot of Daily Pulse hero + one CTA. Below: Tier 2 lines per persona-variant, scrollable. |
| Email | Display-face headline, body in neutral sans, single accent on the CTA. Sentence-case. Never "URGENT" or "ACTION REQUIRED." |
| Push notifications | One-line, sentence-case, never escalating. *"Mum just took a reading. 124/82, in pattern."* — not *"NEW READING ALERT!"* |
| Investor deck | Cover: Tier 1 line over a still of the Daily Pulse hero. Body: data-led, premium-restrained. No "TAM × penetration × ARPU = unicorn" dramatic charts. |

---

## §12. What This Document Supersedes & Defers To

### 12.1 Superseded by D11

- **D5** in full. D11 is the new brand brief. D5 is preserved as historical context only.
- **D8 §1 (Brand)** to the extent D8 contained brand-level statements rather than visual-system specifications.

### 12.2 Updated by D11 (will require follow-up edits)

- **D6 (Go-To-Market):** §8 above names the implication; D6 v2 must reslot the channel-and-creative plan.
- **D8 (Design System):** fully superseded by D12 — this happens in the next document, not in D11.
- **D8a (Self-Buyer Mode):** the persona elevation in §2 means D8a's framing of self-buyer-as-distinct-mode is preserved, but the brand-level treatment of self-buyer changes from tertiary to co-primary.
- **D9 (Editorial):** voice rules in D9 are preserved; new forbidden vocabulary in §3.3 augments D9's existing forbidden list. D9 v2 should incorporate.
- **`docs/05-voice-and-claims.md`:** absorbs the new forbidden vocabulary (§3.3) and the Aesop test (§3.5) in a follow-up PR.

### 12.3 Preserved (D11 does not touch)

- **D1 (Competitive):** competitive landscape unchanged.
- **D2 (Unit Economics):** financial model unchanged. Premium positioning may *support* a higher price point but D11 does not commit to one — that's a D6 v2 decision.
- **D3 (Regulatory):** clearance approach unchanged.
- **D4 (App Strategy):** product surface unchanged at the level D4 specifies; D13 will go deeper.
- **D7 (Supply Chain):** unchanged.
- **D10 (Implementation Plan):** sprint-level plan changes in D11's downstream docs (D12–D14 + screen specs), not in D10 directly.

### 12.4 Deferred to subsequent D's

- **D12 — Visual System v2** picks up §5 direction and produces tokens, components, motion specs, both color modes.
- **D13 — Multi-Vitals Constellation Spec** picks up the product-surface implication of §1.1 (the *premium pulse*) and specifies the constellation, the Daily Pulse hero, and the cross-vital correlation surface.
- **D14 — Ambient AI Architecture** picks up §6's narrative voice and specifies the AI surfaces — daily readiness narration, contextual paragraphs, learned-time reminders, monthly baselines.

---

## §13. Open Items & Validation Checklist

### 13.1 Founder validation required before D12 begins

- [ ] LEIKO trademark cleared (USPTO TESS Classes 9 + 10 · NIPC · domains · App Store · Play Store)
- [ ] Founder approves Tier 1 line (§6.1) or proposes alternative
- [ ] Founder confirms Adaeze bracket shift (early 30s to early 40s, dropping the 45–52 cohort to secondary)
- [ ] Founder confirms LEIKO logotype direction (lowercase wordmark, K-anchored, sans-serif geometric-with-warmth)
- [ ] Founder confirms photography direction (real African and African-American families, not stock)

### 13.2 Open for D12 to resolve

- Specific dark-canonical neutral value
- Specific accent color
- Specific display and body typefaces (with licensing path)
- Specific iconography library (custom vs. Phosphor)
- Specific motion durations and easing curves
- Light-mode palette translation

### 13.3 Open for D6 v2 to resolve

- Channel-and-creative plan per market with the new persona ladder
- Pricing implications of premium positioning (does Leiko Plus stay at $9.99/mo or move to $14.99?)
- Localisation strategy per market (Nigeria-specific creative direction, US/UK-specific creative direction)

### 13.4 Open for `docs/` PR to absorb (after D14)

- `docs/05-voice-and-claims.md` — incorporate §3.3 new forbidden vocabulary + §3.5 Aesop test
- `docs/00-tech-stack.md` — pin any new font/animation/charting library D12 introduces
- All `docs/04-screens/*.md` — rewrite to consume new visual system + Daily Pulse hero
- All `docs/03-components/*.md` — rewrite per D12

---

## §14. Sign-Off

This document represents the locked brand position for Leiko v1.0 under the Apple-of-Healthcare pivot. Once founder signs off, D12 begins.

| Role | Name | Sign-off |
|---|---|---|
| Founder / Product Owner | Law (LawOne Cloud LLC) | Pending |
| Brand author | This document | 2026-05-07 |

---

*End of D11 — Brand Repositioning v1.0.*

*Next document: D12 — Visual System v2 (Apple-of-Healthcare). Begins on D11 founder sign-off.*
