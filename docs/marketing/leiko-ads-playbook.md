# The Leiko Ads Playbook — v2

> **📎 Historical reference (stamped 2026-06-02).** This is a dated strategy/spec snapshot, kept for context — **not** living spec. For the app's current behaviour see the docs in `docs/00–15`, `docs/04-screens/`, and the decisions in `docs/_adr/`. Where this document and the shipped app disagree, the app + ADRs win.

**A hardware-DTC + reservation-funnel field manual for paid acquisition on a lean budget, from Nigeria + diaspora into US mainstream.**

Built for: Leiko (com.leiko.app) | Maker: Lawrence O. (primethebrain@gmail.com)
Last updated: May 2026 | Source: leiko-app/docs/marketing/leiko-ads-playbook.md
What's new in v2: reframed around watch sales + reservations. App is the supporting cast, not the hero. Original v1 preserved at leiko-ads-playbook-v1.md.

---

## Why v2 exists

The first version of this playbook optimised for **app installs**. That was the wrong primary metric. The actual product hierarchy is:

1. **The watch** ($200 Leiko / $250 Leiko Pro) — hardware, FDA-listed, EU MDR Class IIa, ISO 13485 certified. The real revenue driver.
2. **The app** — companion that pairs with the watch, shows the readings, runs the family circle. Without the watch, the app is a husk.
3. **Leiko Plus subscription** ($4.99/mo or $39.99/yr) — upsell to a fraction of watch owners after 30+ days of use.

So v2 reorients the entire acquisition funnel around **watch reservations** as the primary conversion event, with app installs as the secondary supporting layer, and subscription as the third-order upsell.

The reservation model means: instead of asking cold ad traffic to pay $200 upfront for a watch from a brand they've never heard of, we ask them to pay a **$50 refundable, credited-toward-purchase deposit** to lock in their watch from the next production run. This collapses conversion friction, builds a public demand signal, and funds the next manufacturing run.

---

## Table of contents

- [Part 1 — Strategy](#part-1--strategy)
- [Part 2 — Product story: what we're actually selling](#part-2--product-story-what-were-actually-selling)
- [Part 3 — Brand voice rules for ads](#part-3--brand-voice-rules-for-ads)
- [Part 4 — Platform deep dives](#part-4--platform-deep-dives)
- [Part 5 — The five core creative angles (re-ordered)](#part-5--the-five-core-creative-angles-re-ordered)
- [Part 6 — AI tool stack with pricing](#part-6--ai-tool-stack-with-pricing)
- [Part 7 — Prompt library](#part-7--prompt-library)
- [Part 8 — Step-by-step platform setup](#part-8--step-by-step-platform-setup)
- [Part 9 — Reservation funnel design](#part-9--reservation-funnel-design)
- [Part 10 — Conversion tracking](#part-10--conversion-tracking)
- [Part 11 — Targeting recipes](#part-11--targeting-recipes)
- [Part 12 — Budget framework](#part-12--budget-framework)
- [Part 13 — The first 30 days, day by day](#part-13--the-first-30-days-day-by-day)
- [Part 14 — Measurement and KPIs](#part-14--measurement-and-kpis)
- [Part 15 — Compliance and policy](#part-15--compliance-and-policy)
- [Part 16 — Templates and ready-to-fork campaigns](#part-16--templates-and-ready-to-fork-campaigns)
- [Part 17 — Resources and glossary](#part-17--resources-and-glossary)

---

# Part 1 — Strategy

## The three constraints and the one hidden asset

The strategy that follows respects all four. Naming them upfront:

**Constraint 1: Inventory.** 30 Leiko watches in Nigeria, immediate. Beyond that, units come from a manufacturing run that we want this campaign to fund.

**Constraint 2: Capital.** $500-2,000/mo ad budget in Phase 1. This is a learning + signal budget, not a scaling budget.

**Constraint 3: Geography.** Watches are in Nigeria. Bulk capital is in the US. The diaspora bridges them.

**Hidden asset: Regulatory pedigree.** FDA Establishment Registration, EU MDR Class IIa classification, ISO 13485 manufacturing. No mainstream "BP smartwatch" competitor has this. This is a marketing moat most product founders would kill for.

## The reservation funnel

The single most important change in v2: we are not asking cold traffic to buy a $200 watch. We are asking them to **reserve their spot in the next batch with a $50 refundable deposit, credited toward purchase**.

```
Ad
 ↓
leiko.health/reserve
 ↓
Email + ship-to address + $50 deposit (Paystack NG / Stripe US)
 ↓
Confirmation page + reservation number ("You're #1247")
 ↓
[Watch ships, weeks or months later]
 ↓
"Your Leiko is ready — $150 remaining" → user completes purchase
 ↓
Watch arrives → QR code in box → app install → pairs with watch
 ↓
30+ days of use → in-app Leiko Plus subscription prompt
```

Three things make this powerful:

**a) Conversion friction collapses.** Asking $50 instead of $200 raises the click-to-conversion rate by roughly 4-6×. A $1,500/mo ad budget that would have generated ~10-15 outright watch purchases now generates 60-100 reservations.

**b) The demand signal becomes a marketing asset.** "5,000+ people have reserved Leiko" appears on the landing page, in PR pitches, in investor decks, and reinforces every subsequent ad. The number compounds.

**c) Reservations fund production.** $50 × 100 reservations = $5,000 in production capital, ahead of the manufacturing run. The campaign is self-funding instead of capital-burning.

## Phase 1: Nigeria + US-Nigerian diaspora — reservations primary (days 0-45)

**Why these two audiences:**

- **Nigeria** — low Meta CPM ($1-5), watches are local for the first 30 buyers, founder home market, organic word-of-mouth easy
- **US-Nigerian diaspora** — US-level spending power, emotional connection to the product (their parents have hypertension), they ship watches back to Lagos relatives (you confirmed cross-border shipping is supported)

**Budget split:**

| Audience | Budget % | Primary platforms |
|---|---|---|
| Nigeria — middle-class urban (Lagos, Abuja, PH, Ibadan, Kano) | 45% | Meta, Google Search |
| US-based Nigerian-American caregivers (Houston, ATL, DC, MD, NJ, NYC, LA) | 40% | Meta only (best diaspora targeting) |
| Testing buffer (new angles, new platforms) | 15% | TikTok pilot, alternate landing pages |

**Phase 1 success criteria (45 days):**

- 800-1,500 reservations total
- CPA per reservation under $15 (Nigeria) / under $30 (diaspora)
- All 30 current-inventory watches sold to early Nigerian reservers
- A waitlist of 500-1,200 deposit-paying reservation holders for the next batch
- 2-3 creative angles validated as winners

## Phase 2: US mainstream (days 45-120)

Once Phase 1 is running and the manufacturing run is underway, expand to mainstream US.

You arrive at Phase 2 with battle-tested creative, a real demand signal, and a warm reservation pool to convert when stock ships. That's a far stronger starting position than launching cold.

**Phase 2 budget mix:**

| Audience | Budget % |
|---|---|
| US mainstream caregivers | 50% |
| Nigerian diaspora (continued) | 25% |
| Nigeria local (continued) | 15% |
| Testing buffer | 10% |

Phase 2 budgets typically 3-5× Phase 1.

---

# Part 2 — Product story: what we're actually selling

This section is the most important in the manual. If your ads don't tell this story clearly, no amount of budget optimisation matters.

## The product in one sentence

**Leiko is the wristwatch + app system that shows you what your daily life does to your blood pressure — using a real cuff, FDA-listed, so the numbers are ones you can actually trust.**

That sentence carries three claims, each of which can be the lead in an ad:

1. **The cuff is real, not optical** — competitive moat
2. **Your daily life shows up in the numbers** — the unique product magic
3. **FDA-listed, EU MDR Class IIa, ISO 13485** — credibility moat

## The three pillars in detail

### Pillar 1: A real cuff, not an estimate

Every other "BP smartwatch" (Apple Watch, Galaxy Watch, Fitbit, Wahoo, Aktiia) measures blood pressure by guessing from your pulse signal — the optical (PPG) method. None of them have FDA clearance for blood pressure measurement, because PPG-based BP measurement physically can't get cleared at the accuracy required for a medical claim.

Leiko's wristwatch contains an actual inflating micro-cuff. Same oscillometric method as the cuff at your doctor's office. The cuff inflates, holds, deflates, reports a number. Trustworthy.

In ad language:
> "Most BP smartwatches estimate. Leiko measures. With a real cuff."
> "The only consumer wristwatch with a real inflating cuff."

### Pillar 2: Your daily life shows up in the numbers

The point of consistent tracking isn't the number — it's the **pattern**. Leiko's app quietly correlates your blood pressure with the rest of your day:

- "Your BP was 12 points lower today after your 7am walk."
- "Your resting heart rate has settled three points lower over the past week."
- "You averaged 6.8 hours of sleep last week. Your morning BP averages 8 points higher when sleep is under 7 hours."
- "On days when you take a midday walk, your evening BP averages 11 points lower."

This is **the product magic**. Not just data — visible cause and effect that lets the user change their life with evidence instead of guesses. This pulls in wellness/biohacking/longevity audiences who'd never click an ad for "a blood pressure monitor".

In ad language:
> "See what your day does to your numbers."
> "A real cuff. A clear pattern. Your evidence to change."
> "What's actually lowering your blood pressure? Your watch finally knows."

### Pillar 3: FDA-listed, EU MDR Class IIa, ISO 13485

Three regulatory credentials that almost no other consumer BP watch has:

- **FDA Establishment Registration #3011654863** — registered with the US Food and Drug Administration as a medical device manufacturing site
- **EU MDR Class IIa** — classified in the European Medical Device Regulation framework alongside glucose meters and other home diagnostic devices
- **ISO 13485** — built in a facility certified to the international standard for medical device quality management systems

In ad language:
> "FDA-listed. EU Class IIa. Built in an ISO 13485 facility. Not a sports tracker."
> "The clinical pedigree of a doctor's-office cuff. On your wrist."
> "Most BP smartwatches are sports trackers in disguise. Leiko is the real thing."

## The app's job in this story

The app does NOT lead the ads. It supports the watch. Specifically:

- **The home screen of the app** shows the five vitals view (BP, HR, SpO2, sleep, activity) — visible to anyone who picks up the watch owner's phone
- **The Family Circle** lets up to 5 invited people see the watch owner's readings — turns the watch into a family-connected product, not just a personal device
- **The "For your doctor" PDF** lets the watch owner take real data into their next appointment
- **Ask Leiko** answers plain-English questions about readings
- **The correlations + trends view** is where Pillar 2 ("your day shows up in your numbers") actually lives

The app is what makes the watch USEFUL after purchase. In ads, the app is the credibility signal that the watch is part of a complete system — but the watch is the hero.

## The subscription's job in this story

Leiko Plus ($4.99/mo, $39.99/yr) is **a post-purchase upsell**, not an acquisition channel. It unlocks:
- The richer "For your doctor" PDF with charts and a cover letter
- Full trends history beyond the free 7-day window
- Higher monthly Ask Leiko quota
- Weekly cross-vital summaries
- Quiet anomaly notices

This is invisible in cold ad creative. The subscription gets pitched **inside the app after 30+ days of use**, when the watch owner has already become a user.

---

# Part 3 — Brand voice rules for ads

Every ad you publish — image, video, headline, voiceover, description — must pass both Leiko's voice rules AND ad-platform health policy. The good news: both rule sets align. The bad news: a single violation can disable your ad account.

## Words that must never appear in any ad

- **patient** — use "you", "your parent", "the person you care for"
- **diagnose / diagnosis / diagnostic** — Leiko doesn't diagnose. Use "track", "see", "measure"
- **treat / treatment / cure** — Use "track", "understand", "watch over"
- **predict / prevent** applied to disease — "predict your sleep" is fine; "prevent stroke" is not
- **silent killer / ticking time bomb / before it's too late** — fear bait, always banned
- **medical advice** — Leiko doesn't give it. Use "Talk to your doctor"
- **dangerous level / critical level** — alarmist. Use "worth a second look"
- **lower your blood pressure / reduce your BP** — outcome promises Meta will reject

## Phrasings that pass

- "Take a real blood pressure reading"
- "Watch over your health"
- "See how your day shows up in your numbers"
- "See what's actually moving the needle"
- "Talk to your doctor"
- "FDA-listed. EU Class IIa."
- "Built in an ISO 13485 facility"
- "Real cuff. Real number."
- "Reserve your Leiko for the next batch"

## Visual rules

- **No red** anywhere in ad creative — red is reserved for the app's "confirmed-urgent" state, using it in marketing breaks the calm brand
- **No fear imagery** — no clutching chest, no worried doctor, no flashing warning numbers
- **No "before / after" outcome shots** showing BP falling — outcome promises
- **No stock-photo white coats** — too generic, reads as inauthentic
- **Show the actual watch hardware** — real product photography always, especially in the hero shot

## What's allowed

- Warm calm palette: dark warm `#0A0907`, copper `#E8A063`, cream
- Real product photography
- Editorial illustration
- Caregiver scenes (adult child + parent, partner + partner)
- Real app screenshots
- Trust badges (FDA-listed, EU Class IIa, ISO 13485) — important and underused in v1

## The "would a worried mother believe it" test

Before publishing any ad, read it as if you were Mum scrolling on Facebook. If it makes her anxious or doubtful, it fails. **Calm confidence is the win.**

---

# Part 4 — Platform deep dives

Three platforms matter for Phase 1, ranked by fit for Leiko's hardware-DTC + reservation funnel.

## 4.1 Meta (Facebook + Instagram) — primary, ~70% of budget

**Why #1**: Best demographic targeting for caregivers (40-65, married, parents). Best diaspora targeting (the "Nigerian connection" + "United States" combo nothing else can match). Sales-objective ads (with a Pixel on leiko.health) optimise toward purchases — exactly the conversion event we care about. Carousel format works for "see all 5 vitals" storytelling.

**The shift from v1**: Use **Sales objective**, not App Promotion. Conversion event is **"Reservation Completed"** (a Pixel event fired when the user pays the $50 deposit on leiko.health/reserve), not "App Install".

**Account structure**:

```
Meta Business Manager (primethebrain@gmail.com)
└── Ad Account: Leiko
    ├── Pixel: Leiko Web (on leiko.health) — primary conversion source
    ├── App: com.leiko.app (linked via SDK, secondary)
    └── Campaigns:
        ├── CAMP 1 — Sales — Nigeria reservations
        ├── CAMP 2 — Sales — US diaspora reservations
        ├── CAMP 3 — Sales — US mainstream waitlist (no payment yet, just email + name)
        ├── CAMP 4 — Retargeting — visitors who didn't reserve
        └── CAMP 5 — App Install — secondary brand layer (lower budget)
```

**Best formats**:

- **Carousel ads (4-6 cards)** — show the watch, then the cuff inflating, then the app, then the family circle, then the FDA badge. Each card builds the story.
- **Reels (9:16, 15-30s)** — the watch inflating + a quick line of voiceover lands at low CPM
- **Single image (1:1 or 4:5)** — for the FDA-badge trust ads
- **Stories (9:16, 15s)** — quick "reserve yours" CTAs

**Bidding**:

- Phase 1: **Cost cap** at your target CPA ($15 NG / $30 diaspora). Start tight; loosen if delivery is slow.
- Phase 2: Switch to **Lowest cost** with no cap once you have data.

## 4.2 Google Ads (Search + Performance Max) — secondary, ~20% of budget

**The shift from v1**: Move from UAC (Universal App Campaigns) to **Search + Performance Max with leiko.health as the destination**. Google Search captures high-intent buyers Googling "blood pressure smartwatch" or "FDA cleared BP watch", which has much higher purchase intent than app-install ads.

**Account structure**:

```
Google Ads (primethebrain@gmail.com)
├── Search — branded ("leiko", "leiko watch")
├── Search — commercial intent ("blood pressure watch", "FDA BP smartwatch", "real cuff smartwatch")
├── Search — competitor ("Omron HeartGuide alternative", "Aktiia review", "Apple Watch BP accuracy")
└── Performance Max — broad shopping-style campaign
```

**Best formats**:

- **Search ads** — text headlines + descriptions, destination leiko.health/reserve
- **Performance Max** — auto-distributes across Search, YouTube, Display, Discover from your supplied assets

**Bidding**:

- Search: **Maximise conversions** with target CPA of $25 NG / $50 diaspora
- Performance Max: same target CPA

**Skipping**: UAC for app installs in Phase 1. Add back in Phase 2 as a secondary brand layer.

## 4.3 TikTok For Business — testing slot, ~5-10% of budget

**Why #3**: Lowest CPM of major platforms. Caregiver demographic on TikTok grows fastest. UGC-style works well. Excellent for video-first creative.

**Best formats**:

- **In-Feed video** (9:16, 15-30s) — founder talking to camera, real product b-roll
- **Spark Ads** — boost organic posts (or partner creator's posts) to extend reach

**Conversion path**: TikTok pixel on leiko.health, optimise for "Complete Registration" event (the reservation form submit).

## 4.4 What we're NOT doing in Phase 1

- YouTube In-Stream — deferred to Phase 2 (needs video production scale)
- App-install-primary ads — deferred to secondary 20% layer
- LinkedIn / X / Reddit — not where this audience converts
- Display network blanket — too broad for a hardware DTC launch

---

# Part 5 — The five core creative angles (re-ordered)

Run all five in parallel from week 1. Three variants per angle. Kill the bottom 5 after week 1; refresh winners weekly.

## Angle 1 — The Real Cuff Differentiator (NEW HERO ANGLE)

**Premise**: Every other "BP smartwatch" estimates. Leiko measures. With a real cuff. Lead with the hardware moat.

**Headline**: "A real cuff. A real number. Not an estimate."

**Visual**: Close-up of the Leiko watch on a wrist, the fabric cuff visibly inflating, holding, then deflating. End on a calm reading like "118/76" with a steady checkmark.

**Voiceover (if video)**: "Most blood pressure smartwatches estimate from your pulse. Leiko measures with a real cuff — the same method as the cuff at your doctor's office. Reserve yours for the next batch."

**CTA**: "Reserve yours for $50. Pay the rest when it ships."

**Target**: Adults 40-65, interests "blood pressure monitor", "wearables", "health gadgets". Strongest for self-buyers.

## Angle 2 — The Regulatory Pedigree (NEW)

**Premise**: We have FDA + EU + ISO certifications. Almost no smartwatch competitor does. This is rare and worth saying.

**Headline**: "FDA-listed. EU-classified. Built in an ISO 13485 facility."

**Visual**: A clean badge composition — watch in the center, three credibility badges (FDA, EU MDR Class IIa, ISO 13485) arranged around it. Warm dark background. Copper accents.

**Voiceover**: "Most BP smartwatches are sports trackers in disguise. Leiko is FDA-listed, EU classified, and made in a facility certified to ISO 13485 — the international standard for medical device manufacturing. Reserve yours for the next batch."

**CTA**: "Reserve your Leiko. $50 today, $150 when it ships."

**Target**: Adults 45-65 who've done research on BP devices. Skews more clinical, less emotional. Use for retargeting visitors who saw Angle 1 but didn't convert.

## Angle 3 — See What Your Day Does (NEW PRIMARY)

**Premise**: Tracking is pointless without insight. Leiko shows you cause and effect.

**Headline**: "See what your day does to your numbers."

**Visual**: A real screenshot of the app's trends view showing a BP line that dips after an annotated "1-hour walk" point and stays elevated after an annotated "short sleep" point. Hand-lettered annotations.

**Voiceover**: "An hour-long walk. Eight hours of sleep. A stressful meeting. Each one moves your blood pressure. Leiko shows you exactly how much, so you can choose what to change. Reserve yours for the next batch."

**CTA**: "Get your evidence. Reserve Leiko."

**Target**: Self-improvers, wellness/biohacking interests, 35-55. Lifestyle-tracking adjacent. Strongest for self-buyers who are NOT yet hypertensive but want data.

## Angle 4 — The Caregiver

**Premise**: Watch over your loved one's health without having to call.

**Headline**: "I see Mum's blood pressure without having to call."

**Visual**: Adult child (40s, warm lighting, calm expression) glancing at their phone showing the Leiko Family Circle view. Optional: parent's photo softly out of focus.

**Voiceover**: "She lives in Lagos. I live in Houston. With Leiko, I see her blood pressure as she takes it — and so does her doctor. Reserve a Leiko for the parent you watch over."

**CTA**: "Reserve one for them. $50 today."

**Target**: Diaspora caregivers especially — Nigerian-Americans 35-55 with parents back home. Also works for any adult-child-of-aging-parent demographic.

## Angle 5 — The Doctor-Share

**Premise**: Make doctor visits useful. One PDF replaces five minutes of "do you remember last week?"

**Headline**: "One tap. Your doctor has everything."

**Visual**: Hand offering a phone displaying a clean PDF summary to a doctor in a clinic. Warm window light. Doctor's face not shown.

**Voiceover**: "Bring your doctor a clear PDF of your last 30 days. Instead of guessing what your numbers looked like last Tuesday. Reserve your Leiko today."

**CTA**: "Skip the guesswork. Reserve Leiko."

**Target**: Adults 40-65 who recently had a doctor visit. Works for both self-buyers and caregivers.

## How the angles compete

| Angle | Best for | Cost per reservation | Volume |
|---|---|---|---|
| 1 — Real Cuff | Self-buyers, mid-funnel | Lowest | High |
| 2 — Pedigree | Researchers, retargeting | Medium | Low but high-quality |
| 3 — Insight | Wellness, biohacking | Medium | Medium |
| 4 — Caregiver | Diaspora | Medium | High in diaspora |
| 5 — Doctor-share | Both audiences | Medium-low | Medium |

**Expect** Angles 1 and 4 to drive volume; Angles 2 and 3 to drive higher-quality reservations.

---

# Part 6 — AI tool stack with pricing

Same as v1 — the tool stack doesn't change with the strategy. Reproduced here for the standalone manual.

| Job | Tool | Cost | Why |
|---|---|---|---|
| Image generation | **Midjourney v6 Standard** | $30/mo | Best aesthetic control |
| Quick image variations | **DALL-E 3 in ChatGPT Plus** | $20/mo | Integrated with copy generation |
| Short video clips | **Runway Gen-3 Standard** | $15/mo | Best motion quality |
| Voiceovers | **ElevenLabs Creator** | $22/mo | Required for commercial use rights |
| Music beds | **Suno v4 Pro** | $10/mo | Royalty-free |
| Ad copy | **Claude Pro** | $20/mo | Best at honoring voice rules |
| Editing | **CapCut Desktop** | Free | Critical |

**Total monthly stack**: $117/mo. About 6-23% of your Phase 1 ad budget. Acceptable.

**Lean variant (static images only, no video)**:
- Midjourney + Claude + ElevenLabs Starter ($5) + CapCut = $55/mo

---

# Part 7 — Prompt library

Ready-to-paste prompts for the v2 hero angles. Add `--ar 1:1` for feed squares, `--ar 9:16` for stories/reels, `--ar 4:5` for portrait feed, `--ar 16:9` for landscape.

## 7.1 Midjourney — Angle 1 (Real Cuff)

```
Macro product photography of a black sport smartwatch on a person's wrist, the watch has a clearly visible inflated fabric cuff wrapping around the wrist mid-blood-pressure measurement, shot from above at slight angle, dark warm background, single soft top light, copper accent on the watch crown, no logos visible, professional medical device photography aesthetic, sharp focus on the cuff and skin texture, calm confident mood, no text overlay --ar 4:5 --v 6
```

## 7.2 Midjourney — Angle 2 (Pedigree)

```
Editorial badge composition photograph: a Leiko sport smartwatch in the center, three small badges arranged in a quiet triangle around it labeled "FDA LISTED" "EU MDR CLASS IIA" "ISO 13485 CERTIFIED", warm dark background, copper accents on the badges, premium product photography, calm trustworthy mood, no text overlay beyond the badges, minimal composition with negative space --ar 1:1 --v 6
```

## 7.3 Midjourney — Angle 3 (Insight / Day shows up in numbers)

```
Editorial illustration of a flowing blood pressure trend chart line over a calm morning scene: a smartwatch, a wooden countertop, a cup of tea, and a journal. The chart line gently rises and falls, with hand-lettered italic serif annotations pointing to specific dots: "after 1-hour walk", "after stressful meeting", "after 8 hours sleep". Warm dark palette with copper line color. Calm thoughtful mood, no fear, no red, no text overlay beyond the annotations --ar 1:1 --v 6
```

## 7.4 Midjourney — Angle 4 (Caregiver)

```
Editorial photograph of a Nigerian-American woman in her 40s sitting at a sunlit kitchen counter in a US home, holding her smartphone with a calm expression, the phone screen visibly showing a Family Circle view with vitals. Soft warm morning light, deep dark warm background, copper and cream tones, shallow depth of field. A framed photo of her elderly mother visible softly out of focus in background. Candid feel, New Yorker magazine aesthetic, no text overlay --ar 4:5 --v 6
```

## 7.5 Midjourney — Angle 5 (Doctor-share)

```
Editorial photograph from a warm doctor's office: a warm hand offering a smartphone displaying a clean medical PDF summary across a wooden consultation desk, doctor's hands (no face visible) reaching forward to accept the phone. Warm copper light through window blinds, dark green clinic interior, calm professional mood, no white coats, no fear imagery, no text overlay --ar 1:1 --v 6
```

## 7.6 Runway Gen-3 — video prompts

### Angle 1 — Watch inflate Reel (8s)
```
Macro close-up of a black smartwatch on a person's wrist. The fabric cuff slowly inflates over three seconds, holds taut for two seconds, then deflates. Soft top light, dark warm background, single copper accent on the crown. No text. Subtle shallow focus shift at the end revealing a calm reading on the watch face.
```

### Angle 3 — Trends reveal Reel (12s)
```
Top-down view of hands holding a smartphone showing a calm blood pressure trends chart in dark mode. The line gently animates from left to right, with subtle annotations appearing along the way: "after walk" (line drops), "after short sleep" (line rises slightly). Soft kitchen-counter background out of focus. Warm editorial palette.
```

### Angle 4 — Caregiver Reel (15s)
```
Smooth slow camera push-in on a Nigerian-American woman in her 40s at a sunlit kitchen counter, morning light. She glances at her phone with a small, calm half-smile. Subtle camera drift. Calm warm editorial palette. Soft focus depth shift toward the end.
```

## 7.7 ElevenLabs — voiceover scripts

Use the Adam voice (warm masculine, US English) or Bella voice (warm feminine). For NG targeting, try Charlie (Nigerian English) if available.

### Angle 1 (12s)
```
Most blood pressure smartwatches estimate. Leiko measures, with a real cuff.
The same method as the cuff at your doctor's office.
Reserve yours for the next batch — fifty dollars today, the rest when it ships.
```

### Angle 2 (14s)
```
Most blood pressure smartwatches are sports trackers in disguise.
Leiko is F D A listed, classified under European medical device regulation, and built in a facility certified to I S O 13485.
A real medical device, on your wrist.
Reserve yours today.
```

### Angle 3 (15s)
```
A morning walk. Eight hours of sleep. A stressful meeting.
Each one moves your blood pressure.
Leiko shows you exactly how much — so you can change what matters, with evidence instead of guesses.
Reserve yours for the next batch.
```

### Angle 4 (15s)
```
She lives in Lagos. I live in Houston.
With Leiko, I see her blood pressure as she takes it, and so does her doctor.
Reserve a Leiko for the parent you watch over.
Fifty dollars today, the rest when it ships.
```

### Angle 5 (12s)
```
Bring your doctor a clear PDF instead of guessing what your numbers looked like last Tuesday.
Leiko makes it in one tap.
Reserve yours for the next batch.
```

Set ElevenLabs voice settings: Stability 60%, Similarity 75%, Style 35%.

## 7.8 Claude — ad copy prompts

### Generate 10 Meta ad headlines for Angle 1

```
You are writing Meta ad headlines for Leiko, a wristwatch with a real inflating blood-pressure cuff (vs the optical estimates other smartwatches use). The watch is FDA-listed, EU MDR Class IIa, ISO 13485 certified. We are running a reservation campaign — users pay a $50 refundable deposit to lock in their watch from the next manufacturing run, credited toward the $200 final purchase.

Leiko's voice rules forbid: "patient", "diagnose", "diagnosis", "treat", "treatment", "cure", "predict" or "prevent" applied to disease, "silent killer", "ticking time bomb", "before it's too late", "medical advice", "dangerous level", "critical level", "lower your blood pressure" (outcome promise).

Write 10 short Meta ad headlines (under 40 characters each) for the "Real Cuff" angle — leading with the differentiation that Leiko is a real BP cuff, not an estimate. Tone: confident, calm, slightly intellectual. Each headline should be repeatable and memorable. Output as a numbered list. Mark anything that pushes the voice rules with a (RISKY) tag.
```

### Generate Meta primary text for Angle 4

```
Same brand + voice rules as before. Write 5 Meta ad primary text blocks (under 125 characters each) for the "Caregiver" angle — the use case where a US-based Nigerian-American adult child reserves a Leiko watch for their parent in Nigeria. Tone: warm, calm, dignified. Each should land the emotional pull without sentimentality. End each with a CTA toward the $50 reservation. Output as a numbered list.
```

### Voice-check before publishing

```
Review this ad for Leiko. Flag any phrase that violates Leiko's voice rules (forbidden: patient, diagnose, treat, cure, predict/prevent disease, silent killer, ticking time bomb, before it's too late, medical advice, dangerous/critical level, lower your blood pressure). Also flag anything that promises a health outcome.

Headline: <paste>
Primary text: <paste>
CTA: <paste>

If clean, say PASS. If issues, point at the specific phrase and suggest a rewrite.
```

---

# Part 8 — Step-by-step platform setup

Sequenced for a Monday morning.

## 8.1 Meta Business Manager (one-time, 30 min)

1. https://business.facebook.com/overview → Create Account → primethebrain@gmail.com
2. Account name: `Leiko`, currency `USD`, time zone `Africa/Lagos`
3. Add yourself as Admin
4. **Create Ad Account** `Leiko Ads`, USD, Africa/Lagos
5. Add a credit card
6. **Install Pixel on leiko.health** under Events Manager → Web → Pixel name `Leiko Web` → paste the pixel code into the marketing site (give the snippet to the agent maintaining leiko.health, takes 5 minutes)
7. **Add App** under Events Manager → App `com.leiko.app` → Android → links to Play Store listing (this is for the secondary App Install layer)
8. **Verify domain** → add `leiko.health` and add the meta tag to the site
9. **Create Custom Conversions**:
   - "Reservation Completed" — fires on /reserve/thank-you URL with value = $50
   - "Reservation Started" — fires on /reserve URL view
   - "Waitlist Joined" — fires on /us-waitlist/thank-you URL

## 8.2 First Meta campaign — Nigeria Reservations (60 min)

1. Ads Manager → **Create**
2. **Objective**: Sales
3. **Campaign name**: `LK_P1_Reservations_NG_Apr2026`
4. **Budget**: Daily $10
5. **Ad set**:
   - Name: `RealCuff_Angle1_Lagos_Abuja_PH`
   - Conversion location: Website
   - Conversion event: "Reservation Completed"
   - Optimization: Conversions
   - Cost cap: $15 per reservation
6. **Audience**:
   - Locations: Nigeria → Lagos, FCT (Abuja), Rivers (PH), Oyo (Ibadan), Kano
   - Age: 35-65
   - Detailed targeting: blood pressure monitor + health + caregiving + parenting + older adults
7. **Placements**: Automatic (FB feed + IG feed + Reels + Stories + WhatsApp Status)
8. **Ad creative** — 3 ads for Angle 1:
   - Primary text + headline + description from Claude
   - Creative from Midjourney + Runway
   - CTA: "Reserve Now" → leiko.health/reserve
9. Publish

Repeat for the **US Diaspora Reservations** campaign with:
- Locations: US (Houston, Dallas, Atlanta, NYC, DC, MD, NJ, LA, SF)
- Behaviors: African-American + Recent migrant
- Interests: Nigeria + Nigerian music + Naija news
- Cost cap: $30 per reservation
- Same 3 Angle-1 ads (creative localized only if needed)

## 8.3 Google Ads Search — Nigeria (45 min)

1. https://ads.google.com → primethebrain
2. Currency USD, time zone Africa/Lagos
3. **Create campaign**:
   - Goal: Sales
   - Type: Search
   - Bidding: Maximise conversions, target CPA $25
4. **Campaign name**: `LK_P1_Search_NG_Apr2026`
5. **Locations**: Nigeria
6. **Daily budget**: $5
7. **Keywords** (use exact + phrase match):
   - `blood pressure smartwatch`
   - `BP watch`
   - `real cuff smartwatch`
   - `wrist blood pressure monitor`
   - `FDA blood pressure watch`
   - `Omron HeartGuide alternative`
   - `blood pressure monitor Nigeria`
8. **Negative keywords**:
   - `free`, `cheap`, `discount`, `manual` (filter low-intent)
9. **Ads** — 3 responsive search ads:
   - 5 headlines (30 chars each)
   - 5 descriptions (90 chars each)
   - Final URL: leiko.health/reserve
   - Optional sitelinks: /how-it-works, /science, /reviews

Repeat for the **US Diaspora Search** campaign — same keywords with US location targeting at $50 CPA.

## 8.4 TikTok For Business (optional after Meta + Google live)

1. https://business.tiktok.com → primethebrain
2. Install TikTok Pixel on leiko.health
3. Create campaign:
   - Objective: Conversions → Complete Registration
   - Campaign: `LK_P1_TikTok_NG`
   - Daily $5
   - Locations: Nigeria
   - Age 30-55, interests family + parenting + health
4. Ad creative: 3 Runway videos (9:16 vertical, 15-30s)
5. Launch

## 8.5 The leiko.health/reserve page

This is the most important conversion surface in the whole system. Brief for the marketing-site agent (separate task from this playbook):

```
Add a /reserve page to leiko.health.

Page structure:
1. Hero — the Leiko watch product photography, plus a clear price box:
   - "Reserve your Leiko for $50 today."
   - "The remaining $150 ($200 - $50) is due when your watch is ready to ship."
   - "$50 is fully refundable any time before your watch ships."
2. Three trust badges — FDA Establishment Registration #3011654863, EU MDR Class IIa, ISO 13485 — small, prominent, linkable to verification sources.
3. The 5 pillars in a single scroll: real cuff, 5 vitals, family-circle, doctor PDF, plain-language insights.
4. A demand-signal counter: "X people have reserved their Leiko." (live count from Supabase)
5. The reservation form:
   - Name
   - Email
   - Shipping country (dropdown)
   - Shipping address (optional, can complete later)
   - Phone (optional)
   - Variant: [ ] Leiko $200  [ ] Leiko Pro $250
   - Payment: $50 via Stripe (US, UK, EU) or Paystack (NG, ZA, KE)
6. After payment: confirmation page with reservation number, expected ship window, and "Share Leiko with someone you care for" social buttons.

Pixel events to fire:
- Pageview: "ReservationPageView"
- Form start: "ReservationStarted"
- Payment success: "ReservationCompleted" with value=$50 currency=USD
- Each pixel goes to Meta, Google, TikTok respectively
```

---

# Part 9 — Reservation funnel design

The single page on leiko.health is the conversion bottleneck. Design choices here will move CPA up or down by 30-50% with no change to ad spend.

## 9.1 The deposit math

| Element | Value | Why |
|---|---|---|
| Deposit | **$50** | 25% of $200 — substantial enough to deter tire-kickers, small enough that both audiences can commit. Refundable framing reverses the psychological cost. |
| Credited toward purchase | Yes | Users feel they're saving, not spending |
| Refund policy | Full refund any time before ship date; nominal $5 fee after first batch ships | Generous but with friction beyond a certain point |
| Hold mechanism | Stripe (US/UK/EU) or Paystack (NG/ZA/KE) "manual capture" mode — authorize on day 1, capture when the watch is ready | No actual money moves to your account until you ship; reduces fraud + chargeback risk |

## 9.2 Above-the-fold structure

In order of priority on the /reserve page:

1. **Hero shot of the watch** (real product photography, NOT AI-generated)
2. **Price box** — "Reserve your Leiko for $50 today. $150 due at ship."
3. **One-line value prop** — "A real cuff watch that shows you what your day does to your numbers."
4. **Trust strip** — three small badges: FDA / EU / ISO
5. **Demand counter** — "X people have reserved their Leiko."
6. **The reservation form** — short, single column, mobile-first

The user should be able to **reach the form within one mobile scroll** from the hero.

## 9.3 The five trust signals (use all five on the reserve page)

Most BP-watch ads fall down on trust. Leiko has more trust ammo than most. Use it.

1. **FDA Establishment Registration #3011654863** — link to verifiable FDA database
2. **EU MDR Class IIa** classification — link to verifiable EUDAMED entry when available
3. **ISO 13485 manufacturing facility certification** — link to verifiable certificate when available
4. **Real cuff demonstration video** — 8-second loop of the actual cuff inflating on a real wrist
5. **The team / about** — founder's face + name + bio (your real face, your real name)

## 9.4 The post-reservation experience

Don't let the user disappear after they pay $50. The post-purchase experience should:

1. **Confirmation page** — thank you + reservation number + expected ship window + share buttons
2. **Email 1 (immediate)** — receipt + what to expect next
3. **Email 2 (day 7)** — "while you wait" content: how the watch works, what your first reading will look like
4. **Email 3 (day 21)** — social proof: people who've already received their watch
5. **Email 4 (when batch ships)** — "Your Leiko is ready! Complete your purchase for $150"

Use Resend or Mailchimp for the email sequence. The marketing site likely already has Resend wired from your existing /api/contact endpoint.

## 9.5 The refund policy

Be generous. The framing matters more than the absolute policy.

- **Full refund** before the watch ships, processed within 5 business days
- **One-click refund** in their account (don't make them email)
- **Small fee ($5)** for refunds after the first ship batch, only because we've committed manufacturing
- **No questions asked** for everything else

This generous framing actually INCREASES reservation conversion because the perceived risk drops to near-zero.

---

# Part 10 — Conversion tracking

The Pixel on leiko.health is more important than any SDK in the app. The app is a downstream event; the website is where the money happens in Phase 1.

## 10.1 Meta Pixel on leiko.health

What needs to fire:

| Event | When | Value |
|---|---|---|
| **PageView** | Every page load | — |
| **ViewContent** | /reserve page view | — |
| **InitiateCheckout** | User starts filling the form | — |
| **Purchase** | Stripe/Paystack returns success | $50, USD |

The standard Meta Pixel JavaScript handles this. The marketing-site agent adds it in 10 minutes.

**Also**: set up the **Conversions API (CAPI)** server-side. When Stripe/Paystack confirms a reservation, send the same event to Meta's CAPI endpoint with the user's hashed email + IP. This server-side mirror is more reliable than the browser-side Pixel (Safari ITP, ad blockers, etc.).

## 10.2 Google Tag Manager / Google Ads conversion tracking

Add the Google Ads conversion tag on the reservation thank-you page. Conversion value = $50. Set the conversion action category as "Sign-up" or "Reservation".

## 10.3 TikTok Pixel

TikTok's "Complete Registration" event on the reservation thank-you page.

## 10.4 What we wire in the app

The app-side tracking is **secondary** in Phase 1, but doesn't disappear:

- Meta SDK fires `fb_mobile_activate_app` on open
- PostHog fires user-level events (already wired)
- Sentry catches crashes (already wired)

The new event to add post-Phase-1: when a user installs the app via the in-box QR code AND pairs the watch, we fire a "WatchPairedFromReservation" event that we can match back to the original reservation (via email or device ID matching) — this closes the loop on attribution.

Let me know when you want PR #8 to wire the Meta SDK + Conversions API. About 3 hours of engineering.

---

# Part 11 — Targeting recipes

Concrete copy-pasteable targeting for Phase 1.

## 11.1 Meta — Nigeria reservations

- **Locations**: Nigeria → Lagos, FCT, Rivers, Oyo, Kano (urban only)
- **Age**: 35-65
- **Languages**: English
- **Detailed targeting Include any**:
  - Interests: Blood pressure monitor, Smartwatch, Health and wellness, Caregiving, Family + parenting, Older adults
  - Behaviors: Engaged shoppers
- **Exclude**: Education > High school only (filters out younger uneducated cohort)
- **Estimated reach**: 800K-2M

## 11.2 Meta — US-Nigerian diaspora reservations

- **Locations**: US → Houston, Dallas, Atlanta, NYC, DC, Maryland, New Jersey, Chicago, LA, SF
- **Age**: 30-55
- **Languages**: English (US)
- **Detailed targeting Include all**:
  - Behaviors > Multicultural Affinity > African-American (Meta's closest Nigerian-American proxy)
  - Interests: Nigeria, Nigerian cuisine, Naija news, Lagos, Burna Boy, Davido, Wizkid, Nollywood
- **Or include**:
  - Friends of pages "Nigerian Diaspora", "Naija in America", "Nigerian community" pages
- **Estimated reach**: 200K-600K

## 11.3 Meta — US mainstream (Phase 2 only)

- **Locations**: United States
- **Age**: 40-65
- **Detailed targeting**: Interests Caregiving, AARP, Family health, Blood pressure monitors
- **Behaviors**: Family-based health decision makers
- **Estimated reach**: 5M+

## 11.4 Google Search — Nigeria keywords

- `blood pressure smartwatch` (exact + phrase)
- `BP watch` (exact + phrase)
- `wrist blood pressure monitor` (exact + phrase)
- `real cuff smartwatch` (exact + phrase)
- `FDA blood pressure watch` (exact)
- `Omron HeartGuide alternative` (exact)
- `blood pressure monitor Nigeria` (phrase)
- Negatives: `free`, `cheap`, `discount`, `manual`

## 11.5 Google Search — US diaspora keywords

Same as above plus:
- `blood pressure watch for parents`
- `wearable BP monitor doctor`
- `FDA cleared smartwatch BP`

---

# Part 12 — Budget framework

## 12.1 Phase 1 daily split at $1,000/mo

| Platform | Audience | Daily $ | Monthly $ |
|---|---|---|---|
| Meta Sales | Nigeria | $11 | $330 |
| Meta Sales | US diaspora | $10 | $300 |
| Google Search | Nigeria | $4 | $120 |
| Google Search | US diaspora | $4 | $120 |
| Meta App Install (secondary brand) | Both | $3 | $90 |
| Testing buffer / new angles | Various | $1.30 | $40 |
| **Total** | | **$33.30** | **$1,000** |

## 12.2 Phase 1 daily split at $500/mo

| Platform | Audience | Daily $ | Monthly $ |
|---|---|---|---|
| Meta Sales | Nigeria | $6 | $180 |
| Meta Sales | US diaspora | $5 | $150 |
| Google Search | Nigeria | $3 | $90 |
| Google Search | US diaspora | $2 | $60 |
| Testing buffer | Various | $0.65 | $20 |
| **Total** | | **$16.65** | **$500** |

Skip TikTok + Meta App Install at this budget. Add in week 3 if Meta Sales + Google are working.

## 12.3 Phase 1 daily split at $2,000/mo

Double the $1,000/mo allocation. Add TikTok at $10/day. Add Meta App Install at $10/day.

## 12.4 Bid strategies

| Platform | Strategy | Target |
|---|---|---|
| Meta Sales (NG) | Cost cap | $15 per Reservation |
| Meta Sales (US diaspora) | Cost cap | $30 per Reservation |
| Google Search (NG) | Maximise conversions | $25 CPA |
| Google Search (US diaspora) | Maximise conversions | $50 CPA |
| TikTok | Cost cap | $20 per Reservation (NG) |

Phase 2: switch all to **Lowest cost** with no cap once you have 50+ conversions per campaign.

## 12.5 When to scale, when to cut

**Scale a campaign if**:
- CPA at or below target for 7 consecutive days
- Reservation volume of 5+/day at minimum budget
- You have ship-window headroom

**Cut a campaign if**:
- CPA 50%+ above target for 7 days
- Reservation volume <2/day at minimum budget (algorithm starvation)
- 0 reservations after 100 link clicks (audience doesn't convert)

**Scaling moves**: increase budget by 20% per week, not more.

---

# Part 13 — The first 30 days, day by day

## Week 1 — Foundation + reservation page

**Day 1 (Mon)**: Sign up Meta + Google + TikTok ad accounts. Brief the marketing-site agent on the /reserve page + Pixel installation.

**Day 2 (Tue)**: Generate first batch of AI creative — Midjourney images for 5 angles, Runway videos for top 3. Voice-check headlines.

**Day 3 (Wed)**: Set up Meta Sales campaigns (Nigeria + diaspora) at $5-10/day. Don't launch yet.

**Day 4 (Thu)**: Set up Google Search campaigns. Don't launch yet.

**Day 5 (Fri)**: /reserve page goes live on leiko.health with Pixel installed. Test the flow yourself end-to-end (use a real $50 payment then refund yourself). Launch all 4 campaigns Friday end of day.

**Day 6-7 (weekend)**: Don't touch. Let the algorithms learn.

## Week 2 — First learnings

**Day 8 (Mon)**: Review week 1 data.
- Total reservations?
- CPA per platform?
- Which angle is winning?

Generate 5 new creative variations of top 2 angles.

**Day 9 (Tue)**: Add 5 new variants to top-performing campaigns. Pause bottom 3 ads per campaign.

**Day 10 (Wed)**: If CPA is on target, raise daily budgets by 20%.

**Day 11-12**: Add Angles 2 (Pedigree) and 3 (Insight) as new ad sets. Now running 3 angles.

**Day 13-14 (weekend)**: Don't touch.

## Week 3 — Add TikTok + first scale

**Day 15 (Mon)**: Review week 2. By now expect 50-150 reservations cumulative.

**Day 16-17**: Launch TikTok Nigeria at $5/day with top 3 video variants.

**Day 18-19**: Add Angle 4 (Caregiver) and Angle 5 (Doctor-share) for US diaspora specifically.

**Day 20-21 (weekend)**: Don't touch.

## Week 4 — Optimise + prep Phase 2

**Day 22 (Mon)**: Major review. Expect 200-500 reservations cumulative.

**Day 23-24**: Refresh creative — 5 new variants of top angle to fight ad fatigue.

**Day 25-26**: If US-mainstream interest is showing up in your data, set up the US-mainstream campaign (different from diaspora) at $10/day.

**Day 27-28**: Document what worked. Update playbook with learnings.

**Day 29-30**: Plan Phase 2 — manufacturing run kickoff, batch-1 ship window communication to reservation pool.

---

# Part 14 — Measurement and KPIs

## 14.1 The numbers you watch every day

**Top of funnel**:
- Impressions, CTR, CPM per platform

**Middle of funnel**:
- Reservation page views
- Form starts
- Form completions
- **CPA per reservation** — primary metric

**Bottom of funnel (post-Phase-1)**:
- Reservation → purchase conversion (60-80% target with $50 deposit)
- Watch arrival → app install rate (target 80%+, given the QR card in box)
- App install → subscription rate (target 5-15% in first 90 days)

## 14.2 Weekly review template

```
Week of:           [date]
Total spend:       $___
Reservations:      ___ (target: 15+/wk by week 2)
CPA:               $___ (target: <$15 NG, <$30 US diaspora)
Deposits collected:$___ (≈ reservations × $50)
Top creative:      ____________
Bottom creative:   ____________
Notes:             ____________
```

## 14.3 The real success metric

Forget CAC vs LTV for a moment. The real Phase 1 success metric is:

> **"Did we collect more in $50 reservation deposits than we spent on ads?"**

If yes — even before any watch actually ships — you've built a self-funding acquisition engine. That's the proof point you want for Phase 2 budget expansion.

Math: at $15 CPA per reservation and $50 deposit each, you net $35 per reservation immediately. The full $200 watch revenue comes later when batch 1 ships.

---

# Part 15 — Compliance and policy

## 15.1 The big three rules

1. **No outcome promises**. "Lower your BP" / "Cure hypertension" / "Live longer". All forbidden, all flagged by platforms.
2. **No fear language**. "Silent killer" / "Before it's too late". Forbidden by Leiko's voice rules AND platform policy.
3. **No medical claims about the app**. "Diagnose" / "Treat" / "Cure". The hardware has FDA Establishment Registration but that's manufacturing-site registration, not a treatment claim.

## 15.2 The 10-box voice-rule check (run before publishing every ad)

```
[ ] No "patient" anywhere
[ ] No "diagnose / treat / cure / prevent disease"
[ ] No "silent killer / ticking time bomb / before it's too late"
[ ] No "medical advice"
[ ] No "dangerous level / critical level"
[ ] No outcome promises ("lower your BP", "live longer")
[ ] No red colors in creative
[ ] No fear imagery (clutching chest, worried doctor, alarming numbers)
[ ] FDA / EU / ISO claims are factually correct
[ ] CTA leads to reservation, not a medical claim
```

## 15.3 The certifications — what you can and can't say

**Can say**:
- "FDA-listed"
- "FDA Establishment Registration #3011654863"
- "EU MDR Class IIa"
- "Built in an ISO 13485 facility"
- "The same method as the cuff at your doctor's office" (factually true — oscillometric)

**Cannot say**:
- "FDA-cleared for treatment" (Leiko's FDA registration is for the manufacturing site, not a treatment indication)
- "Diagnostic device" (it's monitoring, not diagnostic)
- "Doctor-recommended" (unless you have actual endorsements with documentation)

If in doubt: cite the specific registration number and let the reader verify. Numbers + verifiable links are platform-safe.

## 15.4 What to do if an ad is rejected

1. Don't appeal immediately. Read the rejection reason.
2. Edit the offending element. Don't resubmit unchanged.
3. If repeated rejections (3+) on the same grounds: your account is at risk. Pause that platform; contact your rep if you have one.

---

# Part 16 — Templates and ready-to-fork campaigns

## 16.1 Meta Sales Reservations — Nigeria

```
Campaign objective:    Sales
Campaign name:         LK_P1_Reservations_NG_Apr2026
Budget type:           Daily, $11
Bid strategy:          Cost cap, $15 per Reservation

Ad set name:           RealCuff_Angle1_NG_UrbanCore
Conversion location:   Website
Conversion event:      "Reservation Completed"
Optimization:          Conversions
Audience location:     NG > Lagos, Abuja, PH, Ibadan, Kano
Audience age:          35-65
Audience interests:    Blood pressure monitor + smartwatch + health + caregiving + parenting + older adults
Audience exclude:      High-school education only
Placements:            Automatic

Ad 1 (Angle 1 - Real Cuff):
  Primary text:        "Most BP smartwatches estimate. Leiko measures. With a real inflating cuff — the same method as the cuff at your doctor's office."
  Headline:            "A real cuff. A real number."
  Description:         "Reserve yours for $50 today. The rest when it ships."
  CTA button:          "Sign Up"
  Destination:         https://leiko.health/reserve
  Creative:            [Midjourney watch + cuff close-up image]

Ad 2 (Angle 2 - Pedigree):
  Primary text:        "Most BP smartwatches are sports trackers in disguise. Leiko is FDA-listed, EU-classified, and built in an ISO 13485 facility. The real thing."
  Headline:            "FDA. EU. ISO 13485."
  Description:         "Reserve for $50. Refundable."
  CTA button:          "Sign Up"
  Destination:         https://leiko.health/reserve
  Creative:            [Midjourney badge composition image]

Ad 3 (Angle 3 - Insight):
  Primary text:        "An hour-long walk. Eight hours of sleep. Each one moves your blood pressure. Leiko shows you exactly how much."
  Headline:            "See what your day does."
  Description:         "Reserve yours for $50. Credited toward purchase."
  CTA button:          "Sign Up"
  Destination:         https://leiko.health/reserve
  Creative:            [Midjourney trends + countertop image]
```

## 16.2 Meta Sales Reservations — US Diaspora

Same as 16.1 with:
- Locations: US (Houston, Dallas, Atlanta, NYC, DC, MD, NJ, LA, SF)
- Behaviors: African-American + Recent migrant
- Interests: Nigeria + Naija + Burna Boy + Davido + Wizkid + Nollywood + caregiving
- Cost cap: $30
- Daily budget: $10
- Swap Ad 1 for the Caregiver angle (it converts better here than Real Cuff)

## 16.3 Google Search — Nigeria

```
Campaign goal:         Sales
Campaign type:         Search
Campaign name:         LK_P1_Search_NG_Apr2026
Locations:             Nigeria
Languages:             English
Daily budget:          $4
Bidding:               Maximise conversions, target CPA $25

Keywords (exact + phrase):
  "blood pressure smartwatch"
  "BP watch"
  "wrist blood pressure monitor"
  "real cuff smartwatch"
  "FDA blood pressure watch"
  "Omron HeartGuide alternative"
  "blood pressure monitor Nigeria"

Negative keywords:
  "free", "cheap", "discount", "manual"

Responsive Search Ad:
  Headlines (30 chars each):
    1. "A real cuff BP watch"
    2. "FDA-listed BP watch"
    3. "Reserve Leiko for $50"
    4. "Real readings, real cuff"
    5. "Watch your family's BP"
  Descriptions (90 chars each):
    1. "Real inflating cuff. FDA-listed. Built in ISO 13485 facility. Reserve for $50."
    2. "Most BP smartwatches estimate. Leiko measures. Reserve yours for the next batch."
    3. "Track BP, HR, oxygen, sleep, activity. See what your day does. Reserve from $50."
  Final URL: https://leiko.health/reserve
```

## 16.4 A/B test template

```
Hypothesis:   "Replacing the price with 'fully refundable' in the headline increases CPA-to-reservation by 15%."
Control:      Current best ad
Variant:      Same ad with one headline word changed
Duration:     7 days minimum, 14 days preferred
Sample size:  ≥1,000 impressions per variant
Decision:     95% statistical significance via Meta's built-in A/B tool
```

Don't test multiple variables at once. Don't pause early. Don't read results before 7 days.

---

# Part 17 — Resources and glossary

## 17.1 Glossary (v2 updates)

- **CPA** — Cost Per Acquisition (in v2: per reservation)
- **Reservation** — $50 deposit-locking of a watch from the next batch
- **CAC** — Customer Acquisition Cost (per actual watch buyer, when batch ships)
- **LTV** — Lifetime Value (watch revenue + subscription revenue over customer lifetime)
- **Pixel** — Meta's web tracking snippet for conversion events
- **CAPI** — Conversions API (Meta's server-side event mirror)
- **MMP** — Mobile Measurement Partner (AppsFlyer, Adjust — Phase 2)
- **Cost cap** — Meta bid strategy that limits average cost per conversion
- **Maximise conversions** — Google's auto-bidding strategy for conversion volume

## 17.2 Tools (my picks bolded)

- **Midjourney** ($30/mo Standard)
- **Claude Pro** ($20/mo)
- **ElevenLabs Creator** ($22/mo)
- **Runway Gen-3** ($15/mo Standard)
- **Suno Pro** ($10/mo)
- **CapCut** (free)

## 17.3 Useful reading

- **Demand Curve blog** — short tactical ad guides
- **Reforge — Brian Balfour** — growth fundamentals
- **AppsFlyer benchmarks** — industry CAC by category
- **Meta Blueprint** — free official Meta ad training
- **Google Ads Academy** — free official Google Ads training
- **Kickstarter campaign post-mortems** — Search "Kickstarter analytics teardown" for case studies of reservation campaigns

## 17.4 The single rule that matters most

You'll be tempted to optimise every dial in week 1. Don't. Spend $500-1k learning. Read your data weekly. Iterate creative every 14 days. Trust the algorithms more than your instincts in the first 30 days — they have more data than you.

The Phase 1 → Phase 2 logic gives you the cleanest path from where you are (lean budget, Nigerian inventory, US capital target) to where you want to be (self-funding reservations engine, both markets, repeatable creative). Stick to it.

When you collect your first $50 deposit, take a screenshot. Stick it on your wall. The first $50 of paid-acquisition revenue is a milestone — most founders never get here.

— End of manual v2 —
