# The Leiko Ads Playbook

> **📎 Historical reference (stamped 2026-06-02).** This is a dated strategy/spec snapshot, kept for context — **not** living spec. For the app's current behaviour see the docs in `docs/00–15`, `docs/04-screens/`, and the decisions in `docs/_adr/`. Where this document and the shipped app disagree, the app + ADRs win.

**A field manual for launching paid acquisition on a lean budget, from Nigeria + diaspora into US mainstream**

Built for: Leiko Android (com.leiko.care) | Maker: Lawrence O. (primethebrain@gmail.com)
Last updated: May 2026 | Source: leiko-app/docs/marketing/leiko-ads-playbook.md

---

## Table of contents

- [Part 1 — Strategy](#part-1--strategy)
- [Part 2 — Brand voice rules for ads](#part-2--brand-voice-rules-for-ads)
- [Part 3 — Platform deep dives](#part-3--platform-deep-dives)
- [Part 4 — The five core creative angles](#part-4--the-five-core-creative-angles)
- [Part 5 — AI tool stack with pricing](#part-5--ai-tool-stack-with-pricing)
- [Part 6 — Prompt library (Midjourney, DALL-E, Runway, ElevenLabs, Suno, Claude)](#part-6--prompt-library)
- [Part 7 — Step-by-step platform setup](#part-7--step-by-step-platform-setup)
- [Part 8 — Conversion tracking (what needs to be wired in the app)](#part-8--conversion-tracking-what-needs-to-be-wired-in-the-app)
- [Part 9 — Targeting recipes (Nigeria + diaspora + US)](#part-9--targeting-recipes)
- [Part 10 — Budget framework](#part-10--budget-framework)
- [Part 11 — The first 30 days, day by day](#part-11--the-first-30-days-day-by-day)
- [Part 12 — Measurement and KPIs](#part-12--measurement-and-kpis)
- [Part 13 — Compliance and policy](#part-13--compliance-and-policy)
- [Part 14 — Templates and ready-to-fork campaigns](#part-14--templates-and-ready-to-fork-campaigns)
- [Part 15 — Resources and glossary](#part-15--resources-and-glossary)

---

# Part 1 — Strategy

## The constraints that shape every decision in this playbook

You have three real constraints and one hidden asset. Naming them upfront keeps the strategy honest.

**Constraint 1: Inventory.** Roughly 30 Leiko watches in Nigeria. The whole funnel — ads → app installs → trial starts → paid subscribers → watch buyers — eventually bottlenecks on hardware. The math: if your trial-to-paid rate is 40% and your watch-attach rate among paid is, say, 60%, then 30 watches absorb ~125 paid subscribers worth of demand. You don't need huge ad spend to saturate that.

**Constraint 2: Capital.** $500-2,000 per month, Phase 1. This is a learning budget, not a scaling budget. The goal isn't to optimize for cheapest installs in absolute terms — it's to learn what messaging, audience, and creative converts. By the time inventory replenishes and you can raise budgets, you should have battle-tested ads.

**Constraint 3: Geography.** The watches are in Nigeria. The buyers with money are in the US. These two facts compete. Most founders would either ignore Nigeria (chase the US market) or accept slow growth (Nigeria-only). The diaspora bridge solves it.

**Hidden asset: The Nigerian-American diaspora.** Adult children of Nigerian parents, now living in Houston, Atlanta, London, Maryland, Toronto. They have US-level spending power. They emotionally identify with the product (their parents have hypertension; that's part of why they immigrated to begin with — better healthcare access). They will pay to ship a watch back to Lagos. Meta lets you target them precisely.

## Phase 1: Nigeria + US-based Nigerian diaspora (days 0-45)

Single highest-leverage move you can make on a lean budget.

**Three reasons it works:**

1. **CPM arbitrage.** Nigerian Meta CPMs run $1-5 vs $15-40 in the US for the caregiving demo. Same budget buys you 10× the impressions and 10× the data. You learn fast.

2. **Diaspora has both characteristics:** they're reachable cheaply via Meta's "Nigeria connection" + "United States location" overlap, and they buy at US prices.

3. **Inventory matches addressable demand.** 30 watches × ~50% close rate from interested to purchased = ~60 active sales conversations. Phase 1 generates exactly this scale of demand. Anything more would waste hardware you don't have.

**Targeting split for Phase 1:**

| Audience | Budget % | Platform | Why |
|---|---|---|---|
| Nigeria — middle-class urban (Lagos, Abuja, PH) | 45% | Meta + Google UAC | Watches are local; CPM is low |
| US-based Nigerian-American caregivers | 40% | Meta only | Diaspora is a Meta strength; Google can't segment this well |
| Testing buffer (new angles, new platforms) | 15% | Whatever's promising | Keeps the experiment loop alive |

**Phase 1 spend examples:**

- **$500/mo budget**: $225 Nigeria, $200 diaspora, $75 testing
- **$1,000/mo budget**: $450 Nigeria, $400 diaspora, $150 testing
- **$2,000/mo budget**: $900 Nigeria, $800 diaspora, $300 testing

**Phase 1 success criteria (45 days):**

- 1,000+ installs total
- CPI under $3 (Nigeria) / under $12 (diaspora)
- 100+ trial starts
- 40+ paid subscribers
- 3 creative angles validated as "this works"
- US-mainstream waitlist of 500+ emails

## Phase 2: US mainstream (days 45-120)

Once Phase 1 is producing data and inventory has caught up, expand to mainstream US.

You'll arrive at Phase 2 with proven creative, validated targeting, and a warm US waitlist. That's a far stronger starting position than launching cold.

**Phase 2 mix:**

| Audience | Budget % | Why |
|---|---|---|
| US mainstream caregivers (no Nigerian connection) | 50% | The mass market |
| Nigerian diaspora (continued) | 25% | Still cheaper, still converts |
| Nigeria local (continued) | 15% | Don't abandon the founding market |
| Testing buffer | 10% | New angles |

Phase 2 budgets typically 3-5× Phase 1.

## The diaspora bridge — a separate note

This is unusual enough to call out. Most BP / health apps don't have a strong diaspora play. Leiko does because:

- The founder is Nigerian-American
- The product was designed for cross-border family care
- Nigerian families are tightly emotionally connected even after migration
- High hypertension prevalence in West African genetics — the demographic NEEDS this
- Nigerian-American median household income is **higher than the US average** ($62K+)

Translation: the diaspora isn't a fallback. It's potentially your highest-converting audience.

## The "US waitlist" tactic

While inventory is in Nigeria only, US-targeted ads should land on a leiko.health page with this above-the-fold structure:

1. The product pitch (same as the home page)
2. A clear "**Get notified when Leiko ships to the US**" form
3. Email capture only — no payment, no commitment
4. Optional: SMS opt-in with country-code US

By the time you have US inventory (Phase 2), this list is your warmest audience for a launch-day push. Conversion rates on cold-traffic-to-waitlist average 5-10%; conversion rates on waitlist-to-purchase often hit 15-30% in launch windows.

You can build this page in 2-3 hours with the existing leiko.health stack. Use the same agent that built the privacy/terms pages.

---

# Part 2 — Brand voice rules for ads

Every ad you publish — image, video, headline, voiceover, description — must pass these rules. They protect Leiko's brand AND keep your ads in Meta/Google's good graces. Health categories are where ad accounts get nuked.

## Words that must never appear in any ad

These are non-negotiable. Both your brand spec (docs/05-voice-and-claims.md) and platform policy enforce them.

- **patient** — use "you", "your parent", "your loved one", "the person you care for"
- **diagnose / diagnosis / diagnostic** — Leiko doesn't diagnose. Use "track", "see", "measure"
- **treat / treatment / cure** — Use "track", "understand", "watch over"
- **predict / prevent** — when applied to disease. ("Predict your sleep schedule" is fine; "predict heart attack" is not.)
- **silent killer / ticking time bomb / before it's too late** — fear bait. Always banned.
- **medical advice** — Leiko doesn't give it. Use "Talk to your doctor"
- **dangerous level / critical level** — alarmist. Use "worth a second look"
- **lower your blood pressure / reduce your BP** — outcome promises Meta will reject

## Phrasings that pass

- "Take a real blood pressure reading"
- "Watch over your health"
- "See how your day shows up in your numbers"
- "Talk to your doctor"
- "Track your vitals"
- "Stay close to the people you care for"
- "A calmer way to understand your readings"

## Visual rules

- **No red** anywhere in ad creative. Red is Leiko's confirmed-urgent state in the app — using it in marketing breaks the brand's "no fear language" rule and trains users to associate red with alarm.
- **No fear imagery**. No clutching chest, no worried doctor frowns, no flashing warning numbers.
- **No "before / after"** showing falling BP numbers. Outcome promises.
- **No stock-photo white coats**. Generic "trustworthy doctor" stock is overused and reads as inauthentic.

## What's allowed

- Warm, calm color palette: `#0A0907` dark warm, `#E8A063` copper accent, cream
- Real product photography
- Editorial illustration
- Caregiver scenes (adult child + parent, partner + partner)
- Real screenshots of the app (with permission to use)

## The "would a worried mother believe it" test

Before publishing any ad, read it as if you were Mum reading it on Facebook. If it makes her anxious or doubtful, it fails. Calm confidence is the win.

---

# Part 3 — Platform deep dives

Four platforms matter for Phase 1, plus one regional channel. Ranked by your specific situation.

## 3.1 Meta (Facebook + Instagram) — primary, ~70% of budget

**Why it's #1 for Leiko:**

- Best demographic targeting for caregivers (40-65, married, parents)
- Best diaspora targeting (the "Nigeria connection" interest layer combined with US geographic)
- Strongest emotional storytelling format (Reels, Stories, image)
- Most mature attribution (Conversions API + Pixel + Mobile Measurement)
- Both founder markets (Nigeria, US) are Meta-dominant

**Account structure:**

```
Meta Business Manager (primethebrain@gmail.com)
└── Ad Account: Leiko
    ├── Pixel: Leiko Web (for the marketing site)
    ├── App ID: com.leiko.care (linked via SDK)
    └── Campaigns:
        ├── CAMP 1 — Nigeria, App Install objective
        ├── CAMP 2 — US Diaspora, App Install objective
        ├── CAMP 3 — US mainstream, Waitlist signup objective
        └── CAMP 4 — Retargeting, Trial signup objective
```

**Best formats for Leiko:**

- **Reels (9:16, 15-30s)** — currently highest reach, lowest CPM
- **Feed image (1:1 or 4:5 portrait)** — for emotional stills
- **Stories (9:16, 15s)** — quick lifestyle moments
- **Carousel (1:1, 2-5 cards)** — for "5 vitals" format
- **Video feed (1:1, 4-15s)** — for product demos

**Bidding:**

- Phase 1: use **Cost cap** bidding at your target CPI ($3 Nigeria, $12 diaspora)
- Phase 2: switch to **Lowest cost** with no cap once you have data

## 3.2 Google Ads (UAC + Search) — secondary, ~20% of budget

**Why #2:**

- Captures high-intent search ("blood pressure monitor", "BP watch")
- UAC auto-distributes across YouTube + Search + Display + Play Store
- Less sophisticated demographic targeting than Meta, but better intent capture
- Strongest channel for Play Store discoverability

**Account structure:**

```
Google Ads (primethebrain@gmail.com)
├── App campaign — Installs (UAC)
├── App campaign — In-app conversions (once you have 50+ subscribers)
└── Search — branded + competitor terms
```

**Best formats:**

- **UAC Installs** — set a target CPI ($3-12 depending on geo), feed Google your store listing + 5 headlines + 5 descriptions + 20 image assets + 3 videos
- **UAC In-app actions** — same setup but optimized toward trial-start or subscribe events (requires conversion tracking; see Part 8)
- **Search ads** (advanced) — bid on "blood pressure monitor", "track parent's blood pressure" — only worth setting up after Phase 1

## 3.3 TikTok For Business — testing slot, ~5-10% of budget

**Why #3:**

- Lowest CPM of the major platforms ($2-6 in Nigeria, $8-15 in US)
- Caregiver-aged audience is now strong on TikTok (35-55 segment growing fastest)
- UGC-style ads work well; doesn't reward over-polished production
- Excellent for video-first creative

**Best for:**

- Founder-on-camera ads ("I built this for my mum")
- Authentic product demos
- Education ("3 things your blood pressure reading tells you")

**Lower priority because:**

- Less mature attribution
- Smaller audience for Nigerian diaspora specifically
- Conversion tracking via TikTok pixel is less reliable than Meta

## 3.4 YouTube — long-game, deferred to Phase 2

**Why deferred:**

- YouTube In-Stream needs video production (more capital + time than other formats)
- Slower attribution loops
- Better as a content channel than ads channel for v1

**When to revisit:**

- Phase 2 if you start producing educational content (caregiver tips, BP explainer videos)
- Use YouTube ads to retarget viewers of your organic content

## 3.5 WhatsApp Status Ads (via Meta) — Nigeria-specific, included in Meta budget

WhatsApp Status placements buy through your normal Meta campaign setup. Tick "WhatsApp Status" as a placement on your Nigeria campaigns. Works well because Nigerian smartphone use is WhatsApp-dominant.

---

# Part 4 — The five core creative angles

In Phase 1 run **all five angles in parallel**. Three variants per angle. Total: 15 ads in rotation. Kill the bottom 3-5 after 7 days. Add 3-5 new variants of the top performers in week 2.

## Angle A — The Caregiver Hook

**Premise**: An adult child watches over a parent's health from a distance. The ad invites them to do that with less worry.

**Headline**: "I check Mum's blood pressure without having to call."

**Visual concept**: Adult child (40s, warm lighting, calm expression) glancing at a phone screen showing the Leiko app. Optional: a parent's photo on a bedside table in the background.

**Voice**: warm, reflective. Not sad. Not happy. Calm.

**CTA**: "Watch over your family. Try Leiko free for 7 days."

**Target audience**: Adult children of Nigerian parents (the diaspora), age 35-55, interests = caregiving + family.

## Angle B — The Differentiator Hook

**Premise**: Most "BP watches" don't actually measure blood pressure — they estimate it from heart rate. Leiko has a real cuff.

**Headline**: "A real cuff. A real number. Not an estimate."

**Visual concept**: Close-up of the Leiko watch on a wrist, mid-inflation. The cuff visibly inflating. Result number appears at the end.

**Voice**: confident, slightly intellectual. Not aggressive.

**CTA**: "See the difference. Download Leiko."

**Target audience**: Adults 40-65 who've researched BP wearables — Meta interest "blood pressure monitor".

## Angle C — The Insight Hook

**Premise**: The point of tracking is to learn what affects you. Leiko connects the dots between actions and numbers.

**Headline**: "See what your day does to your numbers."

**Visual concept**: A trends chart on the phone showing BP rising after a stressful day, then settling after a walk. Real screenshot, composed nicely.

**Voice**: curious, thoughtful.

**CTA**: "Try it free for 7 days."

**Target audience**: Self-buyers, age 35-60, interests = wellness, mindfulness, fitness tracking.

## Angle D — The Self-Buyer Hook

**Premise**: Calm daily habit. Take a reading every morning. Drink your tea. Move on.

**Headline**: "Take real readings, every morning. Calmly."

**Visual concept**: Morning kitchen counter scene. Watch on wrist. Cup of tea. Soft light through window.

**Voice**: gentle, ritualistic.

**CTA**: "Start your morning right."

**Target audience**: Adults 45-65 newly aware of hypertension, no caregiver dimension.

## Angle E — The Doctor-Share Hook

**Premise**: Make doctor visits easier. One PDF replaces five minutes of small talk.

**Headline**: "One tap. Your doctor has everything."

**Visual concept**: Hand offering a phone to a doctor in a clinic setting. The doctor's expression reads "this is exactly what I needed."

**Voice**: practical, efficient.

**CTA**: "Get the PDF. Skip the small talk."

**Target audience**: Self-buyers and caregivers, age 40-65, recently had a doctor visit.

---

# Part 5 — AI tool stack with pricing

Every tool you need for Phase 1 creative production, with current pricing and what to use each for.

## Images

| Tool | Cost | Use for | Notes |
|---|---|---|---|
| **Midjourney v6** | $10/mo (Basic) or $30/mo (Standard) | Highest aesthetic quality — lifestyle, emotional scenes | Discord-based UI; takes practice. Standard plan gives unlimited slow GPU which is plenty. |
| **DALL-E 3 (ChatGPT Plus)** | $20/mo | Quick variations, integrated with copy generation in same chat | Easier UI. Slightly less aesthetic control than Midjourney. |
| **Adobe Firefly** | Included with Creative Cloud, or $5/mo standalone | Commercial-safe licensing (important for ad use) | Better for compositing into existing designs |
| **Recraft** | Free tier; $12/mo Pro | Vector + raster, good for icon-style and product mockups | Decent for product compositions |

**My pick for you**: Midjourney Standard ($30/mo) + ChatGPT Plus ($20/mo). That's $50/mo total, covers 95% of image needs.

## Video

| Tool | Cost | Use for | Notes |
|---|---|---|---|
| **Runway Gen-3** | $15/mo (Standard) or $35/mo (Pro) | Short cinematic clips (4-10s) | Best motion quality. Pro gives 4K + 16s clips. |
| **Pika 2.1** | $10/mo (Standard) | Quick experimental video | Lower fidelity but faster. |
| **Sora** | Requires ChatGPT Plus + waitlist access | Best quality when available | Not always accessible. |
| **CapCut Desktop** | Free | Editing, captions, B-roll mixing | Critical — you need this for assembling clips. |

**My pick for you**: Runway Gen-3 Standard ($15/mo) + CapCut (free).

## Voice

| Tool | Cost | Use for | Notes |
|---|---|---|---|
| **ElevenLabs** | $5/mo (Starter) or $22/mo (Creator) | Voiceovers in any voice + language | Best quality. Supports Nigerian English. Creator tier needed for commercial use. |
| **Descript Overdub** | $12/mo (Hobbyist) | Voice cloning your own voice | Only worth it if you want to scale founder VO without recording. |

**My pick for you**: ElevenLabs Creator ($22/mo). Critical for commercial use rights.

## Music

| Tool | Cost | Use for | Notes |
|---|---|---|---|
| **Suno v4** | $10/mo (Pro) or $30/mo (Premier) | Generated music beds | Best quality. Pro is enough. |
| **Udio** | $10/mo (Standard) | Alternative | Comparable to Suno. |
| **Epidemic Sound** | $19/mo | Library of licensed real music | Use for "this needs to feel human" moments. |

**My pick for you**: Suno Pro ($10/mo). Add Epidemic Sound ($19/mo) only if you need real music.

## Copy

| Tool | Cost | Use for | Notes |
|---|---|---|---|
| **Claude 4.7** | $20/mo (Pro) | Ad copy + voice-checking | Best at following voice rules. |
| **ChatGPT Plus** | $20/mo | Quick variations + DALL-E integration | Already on the image list. |

**My pick for you**: Claude Pro ($20/mo) — best at honoring Leiko's voice rules.

## Total monthly AI stack

For full DIY production:

```
Midjourney Standard      $30
ChatGPT Plus              $20
Runway Standard           $15
ElevenLabs Creator        $22
Suno Pro                  $10
Claude Pro                $20
CapCut                     $0
─────────────────────
Total                    $117/mo
```

That's 6-23% of your Phase 1 ad budget. Acceptable.

**Lean variant (skip if you don't need video):**

```
Midjourney Standard      $30
Claude Pro                $20
ElevenLabs Starter        $5
CapCut                     $0
─────────────────────
Total                     $55/mo
```

Use static images only. Video can come in Phase 2.

---

# Part 6 — Prompt library

Ready-to-paste prompts for every angle, every tool. Copy, paste, iterate.

## 6.1 Midjourney v6 — image prompts

Add `--ar 1:1` for feed squares, `--ar 9:16` for stories/reels, `--ar 4:5` for portrait feed, `--ar 16:9` for landscape banner.

### Angle A — Caregiver

```
Editorial photograph of a Nigerian-American woman in her 40s sitting at a sunlit kitchen counter, holding her smartphone with a calm expression, soft warm morning light, deep dark warm background, copper and cream tones, shallow depth of field, looking at the phone with quiet attention, a framed photo of her elderly mother visible softly out of focus in background, candid feel, New Yorker magazine aesthetic, no text overlay --ar 4:5 --v 6
```

```
Editorial photograph of an adult son in his late 30s on a quiet evening, glancing at his phone with the Leiko app open, warm low light, dark green and copper palette, deep blacks but never pure, contemplative not worried expression, blurred suggestion of family photo on shelf behind, cinematic restraint, no text --ar 1:1 --v 6
```

### Angle B — Differentiator

```
Hyperrealistic close-up product photograph of a black sport smartwatch on a person's wrist, the watch has a visible inflated fabric cuff wrapping around the wrist mid-measurement, dark warm background, single soft light from above, copper accent, no logos visible, professional medical device photography aesthetic, sharp focus on the cuff and skin texture, calm mood --ar 4:5 --v 6
```

```
Editorial split-screen photograph: left side shows a generic sports smartwatch reading "120/80?" with a question mark in optical-pulse aesthetic; right side shows the Leiko watch with a clearly inflated cuff reading "118/76" with a steady checkmark; muted warm palette, dark warm background, copper accents, no fear language, calm comparison --ar 16:9 --v 6
```

### Angle C — Insight

```
Editorial illustration of a flowing line chart of blood pressure readings overlaying a calm morning scene of tea, a journal, and a smartwatch on a wooden surface, the chart line gently rises and falls with annotated dots showing "after long walk", "after stressful meeting", "after good sleep", warm dark palette, hand-lettered annotations in italic serif, calm thoughtful mood, no fear, no red --ar 1:1 --v 6
```

### Angle D — Self-buyer

```
Editorial morning kitchen scene photograph, soft light through a window, a person's hand wearing the Leiko smartwatch reaching for a steaming cup of tea, no face visible only hand and forearm, warm wooden countertop, copper accents on the watch, dark green ceramic mug, calm ritualistic atmosphere, shot from slightly above, shallow depth of field, no text, calm and quiet --ar 4:5 --v 6
```

### Angle E — Doctor-share

```
Editorial photograph from a doctor's office: warm hand offering a smartphone displaying a clean medical PDF summary across a wooden consultation desk, doctor's hands (no face) reaching forward to accept the phone, warm copper light through window blinds, dark green clinic interior, calm professional mood, no text overlay, no white coats, no fear --ar 1:1 --v 6
```

### Variations to iterate on

After your first batch of 5, add ONE element at a time:
- Different age (older parent, younger caregiver)
- Different ethnicity for diaspora vs Nigeria audiences (test both Nigerian and African-American)
- Different time of day (morning, evening)
- Different location (home, doctor's office, outdoor walk)
- Different posture (sitting, standing, lying)

## 6.2 DALL-E 3 — image prompts

DALL-E 3 lives inside ChatGPT. Wrap prompts as instructions:

```
Generate a square 1024×1024 photorealistic editorial image for a calm health app advertisement. 

Scene: A Nigerian-American woman in her 40s sitting at a sunlit kitchen counter, holding her smartphone with a calm expression. Soft warm morning light. Deep dark warm background. Copper and cream tones. Shallow depth of field. She is looking at her phone with quiet attention. A framed photo of her elderly mother is visible softly out of focus in the background.

Style: New Yorker magazine aesthetic. Editorial. Restrained. No text overlay. No medical equipment visible. No white coats. No red accents. No alarming expressions.

Mood: Calm confidence.
```

Repeat for each angle. DALL-E tends to need slightly more verbose prompts than Midjourney.

## 6.3 Runway Gen-3 — video prompts

Runway prompts are shorter than image prompts. Lead with the motion.

### Caregiver Reel (10s)

```
Smooth slow push-in on a Nigerian woman in her 40s at a kitchen counter, morning light, her gentle smile at the phone in her hand. Subtle camera drift. Calm warm editorial palette. Soft focus depth shift toward end.
```

### Watch inflate Reel (8s)

```
Macro close-up of a black smartwatch on a person's wrist. The fabric cuff slowly inflates, holds for two seconds, then deflates. Soft top-light, dark warm background, single copper accent. No text. Subtle shallow focus.
```

### Trends Reveal Reel (10s)

```
Top-down view of hands holding a smartphone showing a calm blood pressure trends chart. The line gently animates left to right, showing peaks and valleys. Soft kitchen-counter background out of focus. Warm editorial palette. No text overlay.
```

### Doctor handoff Reel (10s)

```
Slow lateral camera move across a wooden consultation desk. A warm hand passes a smartphone to a doctor's waiting hand. Soft window light. No faces shown. Calm warm clinic interior. No white coats. No fear.
```

## 6.4 ElevenLabs — voiceover scripts

Pick the **Adam** voice (warm masculine, US English) or **Bella** voice (warm feminine, US English) for diaspora targeting. For Nigeria targeting, use the **Charlie** voice (Nigerian English available in newer voice clones) or scripts work in clear US English.

### Caregiver VO (15s)

```
You don't always need to call to know they're okay. 
Leiko shows you their blood pressure as they take it. 
Calm. Real. From anywhere.

Try Leiko free for seven days.
```

### Differentiator VO (12s)

```
Most smartwatches estimate your blood pressure from heart rate. 
Leiko measures it. With a real cuff. 
The kind your doctor uses.

Try Leiko free for seven days.
```

### Insight VO (15s)

```
The point of tracking isn't the number. 
It's the pattern. 
Leiko shows you what your day did to your readings — calmly.

Try Leiko free for seven days.
```

### Self-buyer VO (12s)

```
A calmer morning. A real reading. A clearer view of what your numbers mean.

Try Leiko free for seven days.
```

### Doctor-share VO (10s)

```
Bring your doctor a clean summary instead of a long story. 
Leiko makes the PDF in one tap.

Start your free trial.
```

Set ElevenLabs voice settings: **Stability 60%, Similarity 75%, Style 35%**. Tweak per voice. Generate 2-3 takes; pick the calmest.

## 6.5 Suno v4 — music prompts

Generate a single 30-second instrumental loop for each angle. Use it under your VO.

### General Leiko mood

```
Calm warm editorial instrumental, soft piano with subtle warm strings, slow tempo around 72 BPM, no drums, gentle ambient bed, melancholic but hopeful, no vocals, two minutes long but with a clear start and end
```

### Caregiver / emotional

```
Soft acoustic guitar with warm pad in the background, gentle finger-picked melody, sparse and contemplative, no drums, 65 BPM, no vocals, perfect for a quiet family moment in advertising, two minutes
```

### Differentiator / confident

```
Modern minimalist instrumental, clean piano motif with subtle electronic pulse, calm but forward-moving, no vocals, 78 BPM, professional and trustworthy mood, two minutes
```

Click "instrumental only" in Suno and "Custom mode" to use these as full prompts.

## 6.6 Claude — ad copy prompts

Lead with the voice rules. This is critical.

### Generate 10 Meta ad headlines for the Caregiver angle

```
You are a brand copywriter for Leiko, a blood-pressure tracking app + watch product. Leiko's voice rules forbid: "patient", "diagnose", "diagnosis", "treat", "treatment", "cure", "predict" or "prevent" applied to disease, "silent killer", "ticking time bomb", "before it's too late", "medical advice", "dangerous level", "critical level", "lower your blood pressure" (outcome promises).

Write 10 short Meta ad headlines (under 40 characters each) for the "Caregiver" angle — the use case where an adult child watches over a parent's blood pressure from a distance. Tone: calm, warm, dignified, never alarmist. Lead with the feeling, not the feature.

Output as a numbered list. Mark anything that pushes the voice rules with a (RISKY) tag.
```

### Generate 5 Meta ad descriptions for the Self-buyer angle

```
Same rules as before. Write 5 Meta ad primary text blocks (under 125 characters each) for the "Self-buyer" angle — adult, age 45-65, just starting to take their blood pressure seriously. Tone: calm ritual. Each block should be one or two sentences. End each with a clear CTA.
```

### Voice-check an ad before publishing

```
Review this ad headline + description for Leiko. Flag any phrases that violate Leiko's voice rules (forbidden words: patient, diagnose, treat, cure, predict/prevent disease, silent killer, ticking time bomb, before it's too late, medical advice, dangerous/critical level, lower your blood pressure).

Headline: <paste>
Description: <paste>

If it passes, say "PASS". If it fails, point at the specific phrase and suggest a rewrite.
```

---

# Part 7 — Step-by-step platform setup

Sequenced exactly the way you'd do it on a Monday morning, account by account.

## 7.1 Meta Business Manager (one-time setup, 30 min)

1. Go to https://business.facebook.com/overview
2. Click **Create Account** if you don't have one
3. Sign in as primethebrain@gmail.com
4. Account name: `Leiko`, Account email: same Gmail
5. Add yourself as **Admin** under People settings
6. **Create Ad Account**:
   - Name: `Leiko Ads`
   - Time zone: `Africa/Lagos` (your operational time zone)
   - Currency: `USD` (so reporting matches your budgets in this manual)
   - Payment method: add a credit card
7. **Create Pixel** under Events Manager:
   - Name: `Leiko Web`
   - Source: Website
   - Install: paste the pixel into the marketing site (the agent who built leiko.health can do this in 5 minutes)
8. **Add App** under Events Manager:
   - App ID: `com.leiko.care`
   - Platform: Android (Google Play)
   - This connects to your Play Store listing
9. **Create Domain** under Brand Safety:
   - Add `leiko.health` as a verified domain (requires adding a meta tag to your marketing site)
10. **Create the Conversions API connection** for server-side events (we'll wire this in Part 8)

## 7.2 First Meta campaign (60 min)

1. **Ads Manager → Create**
2. **Objective**: App Promotion
3. **Campaign name**: `LK_Phase1_Caregiver_Nigeria_Apr2026`
4. **Budget**: Daily budget, $10
5. **Ad Set**:
   - Name: `Caregiver_Nigeria_Lagos_Abuja_PH`
   - App: select your Leiko Android app
   - Promote: App installs
   - Optimization for ad delivery: Installs (later, switch to "App events" once events fire)
   - Cost per result goal: $3
6. **Audience**:
   - Locations: Nigeria → Lagos, Abuja, Port Harcourt, Ibadan, Kano
   - Age: 35-65
   - Detailed targeting:
     - Interests: Caregiving, Family + relationships, Parenting, Mindfulness, Older adults
     - Behaviors: "Engaged with health-related content"
   - Estimated audience size should be 800K-2M for Nigeria urban
7. **Placements**: Automatic (let Meta optimize), include Facebook, Instagram, Stories, Reels, WhatsApp Status
8. **Ad creative**:
   - Upload your top 3 Caregiver-angle images (from Midjourney)
   - Primary text: 3 variations from Claude prompts
   - Headline: 3 variations
   - CTA: "Install Now"
   - Destination: Google Play Store URL
9. **Review and publish**

Repeat for the **Caregiver_USDiaspora** campaign with:
- Locations: United States
- Detailed targeting: ADD "Nigeria" as a connection interest + Behaviors > Multicultural Affinity > African-American + Interests > caregiving
- Cost per result: $12

## 7.3 Google Ads Universal App Campaign (UAC)

1. https://ads.google.com → sign in as primethebrain
2. Create a new account, currency USD, time zone Africa/Lagos
3. **Add payment method**
4. **Create campaign**:
   - Campaign type: **App promotion**
   - Goal: Install volume
   - App: search for `com.leiko.care` (your Play Store app)
   - Campaign name: `LK_Phase1_UAC_Nigeria`
5. **Locations**: Nigeria
6. **Languages**: English
7. **Daily budget**: $5
8. **Target CPI**: $3
9. **Asset groups** — upload:
   - 5 headlines (30 chars each, from Claude): "A calmer way to track BP", "Real cuff. Real number.", "Watch over your family", "Take a real reading", "Trial free for 7 days"
   - 5 descriptions (90 chars each)
   - 20 image assets (Midjourney outputs at 1200×628, 1200×1200, 600×314)
   - 3 video assets (Runway outputs, 8-15s, 16:9 and 9:16)
   - HTML5 banners (optional, skip for Phase 1)
10. **Save campaign**

Repeat for **LK_Phase1_UAC_USDiaspora** with locations = US and adjusted CPI.

## 7.4 TikTok For Business (optional, after Meta + Google live)

1. https://business.tiktok.com → create account as primethebrain
2. Account name: `Leiko`
3. Currency: USD, time zone Africa/Lagos
4. **Install TikTok Pixel** on leiko.health (events for waitlist signup)
5. **Create campaign**:
   - Objective: App promotion → Installs
   - Campaign name: `LK_Phase1_TikTok_NG`
   - Optimization: Click → Install
6. **Ad group**:
   - Locations: Nigeria
   - Age: 30-55 (TikTok skews younger)
   - Interests: family + parenting + health
   - Daily budget: $5
7. **Ad creative**:
   - Spark Ads if you have organic posts on a TikTok account
   - In-Feed video ads otherwise (Runway-generated 9:16 vertical, 15s)
   - 3 video variants minimum
8. **Save**

## 7.5 Marketing-site waitlist page (for US-targeted ads while inventory is Nigeria-only)

This is a parallel task you give to whoever builds leiko.health. Brief:

```
Add a /us-waitlist page to leiko.health. Above-the-fold:
- Same hero block as the main page
- A clear callout: "Leiko ships to Nigeria today, US shipping arrives later this year."
- An email-capture form: "Get notified when Leiko ships to the US."
- Optional SMS country-code US opt-in
- After submit: a confirmation page, plus the email is sent to Supabase via the existing /api/reserve endpoint (mark these as waitlist_us in the reservation type field)

This page is where US-targeted Meta + Google ads will land in Phase 1, before US inventory arrives.
```

---

# Part 8 — Conversion tracking (what needs to be wired in the app)

Without proper conversion tracking, Meta + Google can't optimize, and you're flying blind on which ads convert. Here's what needs to land in the app code.

## 8.1 Meta SDK + Conversions API

**What it does**: Tells Meta "this user from your ad just installed", "this user just started a trial", "this user just subscribed". Meta uses these events to optimize delivery and find more people like the converters.

**Why both SDK and CAPI**: SDK fires events client-side (subject to iOS ATT and Android privacy restrictions); CAPI fires events server-side (more reliable, always counted).

**Engineering work** (I do this in a PR when you're ready):

1. Install `react-native-fbsdk-next`
2. Initialize FB SDK in `App.tsx` after Sentry + PostHog init
3. Fire `logEvent('fb_mobile_activate_app')` on every app open (auto-fires after SDK setup)
4. Fire `logEvent('fb_mobile_complete_registration')` on first successful sign-in
5. Fire `logEvent('StartTrial')` on successful purchase of either monthly or annual subscription
6. Fire `logEvent('Subscribe', value: $price)` on first successful renewal
7. Server-side, in the `/revenuecat-webhook` Supabase function, mirror these events to Meta's Conversions API endpoint with the user's email hash + IP + user-agent for matching

Roughly 2-3 hour task. Let me know when you want this PR and I'll open it.

## 8.2 Google UAC tracking

**What it does**: Tells Google Ads "this Play Store install came from a UAC ad", "this user just subscribed".

**Engineering work**:

1. Google's App Conversion Tracking is automatic for installs (Play Store tells Google directly when a UAC click leads to an install)
2. For in-app events (trial-start, subscribe), wire `react-native-google-mobile-ads` events OR call the **Google Analytics for Firebase SDK** which exports events to Google Ads automatically
3. Either approach: 2-hour task

## 8.3 TikTok Pixel

**What it does**: Mirror of Meta — TikTok needs to know which clicks led to installs and subscribes.

**Engineering work**:

1. Install `react-native-tiktok-business-sdk` (community lib)
2. Initialize on app open
3. Fire `track('CompleteRegistration')` on first sign-in
4. Fire `track('Subscribe')` on first purchase
5. 1-hour task

## 8.4 AppsFlyer (cross-platform attribution, optional, recommended once spend >$2k/mo)

**What it does**: A single SDK that handles attribution from all paid sources (Meta, Google, TikTok, ...) and de-duplicates installs across platforms. Without AppsFlyer, each platform claims credit for the same install.

**Engineering work** (only if scaling beyond Phase 1):

1. Install `react-native-appsflyer`
2. Add your AppsFlyer dev key (free tier covers up to 12K monthly installs)
3. AppsFlyer dashboard shows attribution truth
4. 2-hour task

**My recommendation**: Skip in Phase 1. Add in Phase 2 when budget exceeds $2k/mo or you start running 3+ platforms.

---

# Part 9 — Targeting recipes

Concrete, copy-pasteable targeting setups for Phase 1.

## 9.1 Meta — Nigeria local

**Locations**: Nigeria → Lagos State, Federal Capital Territory (Abuja), Rivers (Port Harcourt), Oyo (Ibadan), Kano

**Languages**: English

**Age**: 35-65

**Detailed targeting (Include any)**:
- Interests: Caregiving, Family + relationships, Parenting, Mindfulness, Older adults, Health and wellness
- Behaviors: Engaged Shoppers, Frequent travelers (Nigerian internal)

**Detailed targeting (Exclude)**:
- Demographics > Education > High school (filters out younger uneducated cohort)

**Estimated reach**: 800K-2M

## 9.2 Meta — US Nigerian diaspora

**Locations**: United States → exclude small cities, include Houston, Dallas, Atlanta, New York, Washington DC, Maryland, New Jersey, Chicago, Los Angeles, San Francisco

**Languages**: English (US)

**Age**: 30-55

**Detailed targeting (Include all)**:
- Demographics > Life events > Recent migrant (helps capture recent first-gen immigrants)
- Behaviors > Multicultural Affinity > African-American (Meta's closest proxy for Nigerian-Americans)
- Interests: Nigeria, Nigerian cuisine, Naija news, Lagos, Davido, Burna Boy, Wizkid (cultural connection signals)

**Detailed targeting (Or include)**:
- Friends of people who like the "Naija in America" or "Nigerian Diaspora" pages

**Estimated reach**: 200K-600K

## 9.3 Meta — US mainstream (Phase 2 only)

**Locations**: United States

**Age**: 40-65

**Detailed targeting**:
- Interests: Caregiving, AARP, Family health, Blood pressure monitors
- Behaviors: Family-based health decision makers

**Estimated reach**: 5M+

## 9.4 Google UAC — Nigeria

**Locations**: Nigeria

**Languages**: English

**Bidding**: Target CPI $3

**Audience signals** (UAC's version of targeting):
- Interest categories: Family + Parenting, Health, Older adults
- Custom audiences: people who searched "blood pressure monitor" or "wearable health"

## 9.5 Google UAC — US Nigerian diaspora

**Locations**: United States — specifically the metros listed above

**Languages**: English

**Bidding**: Target CPI $12

**Audience signals**:
- Custom audience: people who watched Nigerian YouTube creators (BBNaija, Mark Angel Comedy, Pulse Nigeria)
- Custom audience: searches for "Nigerian", "Naija", "Lagos"

---

# Part 10 — Budget framework

## 10.1 Phase 1 daily split

For a **$1,000/mo budget** (the middle of your $500-2k range):

| Platform | Audience | Daily $ | Monthly $ |
|---|---|---|---|
| Meta | Nigeria | $10 | $300 |
| Meta | US diaspora | $10 | $300 |
| Google UAC | Nigeria | $4 | $120 |
| Google UAC | US diaspora | $4 | $120 |
| TikTok | Nigeria + diaspora | $4 | $120 |
| Buffer / new tests | Various | $1.30 | $40 |
| **Total** | | **$33.30** | **$1,000** |

For **$500/mo budget**:

| Platform | Audience | Daily $ | Monthly $ |
|---|---|---|---|
| Meta | Nigeria | $5 | $150 |
| Meta | US diaspora | $5 | $150 |
| Google UAC | Nigeria | $3 | $90 |
| Google UAC | US diaspora | $3 | $90 |
| Buffer | Various | $0.65 | $20 |
| **Total** | | **$16.65** | **$500** |

(Skip TikTok at $500/mo. Add in week 3 if Meta + Google are working.)

For **$2,000/mo budget**:

Same split as $1,000/mo doubled. Add TikTok at $10/day.

## 10.2 Bid strategies

| Platform | Strategy | Settings |
|---|---|---|
| Meta | Cost cap → Lowest cost | Start with Cost cap at $3 (NG) / $12 (US). Switch to Lowest cost when CPA stable. |
| Google UAC | Target CPI | $3 (NG) / $12 (US) |
| TikTok | Cost cap | $3 (NG) / $10 (US) |

## 10.3 When to scale, when to cut

**Scale a campaign if**:
- CPI is at or below target for 7 consecutive days
- Trial conversion rate is 15%+ from install
- You have inventory headroom

**Cut a campaign if**:
- CPI is 50%+ above target for 7 days
- Install volume is <10/day at minimum budget (algorithm starvation)
- 0 trials after 50+ installs (the audience doesn't convert)

**Scaling moves**: increase budget by 20% per week, not more. Sudden 100% budget jumps reset the learning phase.

## 10.4 When to kill a creative

Use the "**3-7-30 rule**":

- **Day 3**: Hide ads with CTR < 0.5%. They're DOA.
- **Day 7**: Hide ads where CPI is 50% above campaign average.
- **Day 30**: Refresh creative or kill — ad fatigue sets in around day 21-30 for most creative.

---

# Part 11 — The first 30 days, day by day

## Week 1 — Foundation

**Day 1 (Mon)**: Sign up for Meta Business Manager, Google Ads, TikTok For Business as primethebrain@gmail.com. Add credit card to each. Build the waitlist page on leiko.health (brief the marketing-site agent today).

**Day 2 (Tue)**: Generate first batch of AI creative — 5 Midjourney images (one per angle), 3 Runway videos (Caregiver, Differentiator, Insight). Voice-check headlines with Claude.

**Day 3 (Wed)**: Set up the **Meta Caregiver Nigeria** campaign + the **Meta Caregiver US diaspora** campaign. Daily budget $5 each. Don't launch yet.

**Day 4 (Thu)**: Set up the **Google UAC Nigeria** campaign + **Google UAC US diaspora**. Daily budget $4 each. Don't launch yet.

**Day 5 (Fri)**: Last quality check — voice rules, image quality, landing destinations correct. Launch ALL 4 campaigns Friday end of day.

**Day 6-7 (weekend)**: Don't touch anything. Let them run. Algorithms need 48h of data minimum.

## Week 2 — First learnings

**Day 8 (Mon)**: Review week 1 data.
- Which campaign has lowest CPI?
- Which ad creative has highest CTR?
- Trial starts from any campaign yet?

Generate 5 new creative variations of your top 2 angles.

**Day 9 (Tue)**: Add 5 new ad variants to the top-performing campaigns. Pause the bottom 3 ads from each campaign.

**Day 10 (Wed)**: If Meta Nigeria CPI is on target, raise daily budget by 20% (e.g., $5 → $6). Otherwise, hold.

**Day 11-12**: Add Angle B (Differentiator) and Angle C (Insight) variants. You're now running 3 angles in rotation.

**Day 13-14 (weekend)**: Don't touch.

## Week 3 — Add TikTok + first scale moves

**Day 15 (Mon)**: Review week 2 data. By now:
- One platform should be the clear winner (likely Meta Nigeria)
- One angle should be the clear winner (likely Caregiver or Differentiator)
- 50-200 installs should have flowed in
- 5-30 trial starts

**Day 16-17**: If you have budget headroom, launch **TikTok Nigeria** at $5/day with your top 3 video variants.

**Day 18-19**: Add the **Self-buyer** angle (Angle D) as a new campaign. Test against the proven top angle.

**Day 20-21 (weekend)**: Don't touch.

## Week 4 — Optimize + prep Phase 2

**Day 22 (Mon)**: Major review. By now:
- 200-500 installs cumulative
- 30-80 trial starts
- 8-30 paid subscribers
- 1-2 angles clearly winning
- Initial customer feedback in (read PostHog + Sentry data)

**Day 23-24**: Refresh creative — 5 new variants of the top angle. Existing creative will start to fatigue.

**Day 25-26**: If waitlist signups from US-mainstream Meta are flowing, ramp the US-mainstream campaign to $8-10/day.

**Day 27-28**: Document what worked. Update this playbook with learnings.

**Day 29-30**: Plan Phase 2. Inventory should be replenishing — line up US mainstream launch.

## Day 31+ — into Phase 2

You're now ready to expand to US mainstream with proven creative. Budget scales to $2-5k/mo. Add YouTube. Consider AppsFlyer attribution.

---

# Part 12 — Measurement and KPIs

## 12.1 The numbers you watch every day

**Top of funnel**:
- **Impressions** — total ad views
- **CPM** (Cost Per 1,000 impressions) — health of bidding
- **CTR** (Click-Through Rate) — % of impressions that clicked. Target: 1-3% on Meta, 0.5-1.5% on Google UAC.

**Middle of funnel**:
- **CPI** (Cost Per Install) — total $ spent / installs from ads
- **Install rate** — installs / clicks. Target: 30%+ for Play Store traffic.

**Bottom of funnel**:
- **Trial-start rate** — trials / installs. Target: 15-25%.
- **Trial-to-paid rate** — paid subs / trial starts. Target: 30-50%.
- **CAC** (Customer Acquisition Cost) — total ad spend / paid subscribers. Target: under $120 (3× LTV).

**LTV** (Lifetime Value): With $4.99/mo and an average customer lifetime of 8 months (industry average for health subscriptions), LTV = $40. With $39.99/yr annual = $40 in the first year alone. Realistic target LTV by month 12 of a customer relationship: $60-80.

## 12.2 Where to read each number

| Metric | Source |
|---|---|
| Impressions, CTR, CPM, CPI (per platform) | Meta Ads Manager, Google Ads, TikTok Manager |
| Installs (true total) | Play Console → Statistics → Acquisition |
| Trial-start rate | PostHog → Funnels → Install → push_token_registered → ai_tier_b_started (or similar Plus trigger) |
| Trial-to-paid | RevenueCat → Customers → filter by trial-started → see conversion |
| CAC | Total monthly ad spend (sum of platforms) / paid subscriber count |

## 12.3 Weekly review template

Every Monday, fill in:

```
Week of:        [date]
Total spend:    $___
Installs:       ___ (target: 50+/wk by week 2)
Trial starts:   ___
Paid subs:      ___
CPI:            $___ (target: <$5 NG, <$12 US)
CAC:            $___ (target: <$120)
LTV/CAC ratio:  ___ (target: >3:1)

Top creative:   ____________
Bottom creative:____________
Notes:          ____________
```

## 12.4 What to do when numbers are bad

- **Low CTR (< 0.5%)** → creative is wrong. Generate new images, new headlines.
- **High CTR but low install rate (< 20%)** → Play Store listing is the problem. Improve screenshots, description, app icon.
- **High install rate but low trial start (< 10%)** → in-app paywall isn't compelling. Check the Settings → Export my data flow.
- **High trial start but low trial-to-paid (< 20%)** → in-app value isn't matching the ad promise. Read PostHog funnel for the drop-off.

---

# Part 13 — Compliance and policy

Health ads are the most heavily moderated category on every platform. One violation can disable your ad account. Read this section once and bookmark.

## 13.1 Meta health ad policy — the highlights

**Always rejected**:
- Before/after photos showing health improvement
- "Cure", "treat", "diagnose" — any medical claim
- Promising weight loss / BP reduction / specific outcome
- Implying users are sick ("Are you suffering from...?")
- Targeting personal attributes about health ("you have hypertension...")

**Often rejected**:
- Faces of "real customers" giving testimonials (without explicit consent + clear disclosure)
- Pre-existing health condition imagery
- Medical equipment in clinical settings (without context)

**Usually OK**:
- Watching over your family
- Tracking your numbers
- Talk to your doctor
- Educational content with no specific health claims

## 13.2 Google health ad policy — the highlights

**Always rejected**:
- Same as Meta (cure/treat/diagnose)
- Specific outcome promises
- Health-condition targeting in audience signals

**Special note**: Google requires you certify your app's compliance with healthcare-related laws (HIPAA in US, NDPR in Nigeria). Leiko isn't HIPAA-regulated (not a covered entity) but you should still tick the "applicable laws" certification.

## 13.3 TikTok health ad policy

Most restrictive of the three. TikTok generally blocks:
- Any prescription medical content
- Any health condition mentioned by name (including hypertension)
- Any "diagnosis" or "treatment" framing

What works on TikTok: lifestyle framing ("a calmer morning"), founder authenticity ("I built this for my mum"), educational not promotional.

## 13.4 Voice-rule compliance check (before publishing every ad)

Run every ad through this checklist:

```
[ ] No "patient" anywhere
[ ] No "diagnose / treat / cure / prevent disease"
[ ] No "silent killer / ticking time bomb / before it's too late"
[ ] No "medical advice"
[ ] No "dangerous level / critical level"
[ ] No outcome promises ("lower your BP", "live longer")
[ ] No red colors
[ ] No fear imagery (clutching chest, worried doctor, alarming numbers)
[ ] No fake testimonials (real customer with consent, OR no testimonial)
[ ] CTA leads to install, not a medical claim
```

If all 10 boxes are clear, the ad will (a) honor your voice spec and (b) pass platform review.

## 13.5 What to do if an ad is rejected

1. **Don't appeal immediately**. Read the reason. Often the issue is one word.
2. **Edit the offending element**. Don't re-submit the same ad.
3. **If appeal needed**: provide context — "this is a wellness app, not a medical device; the watch is FDA-listed but the mobile app itself is consumer-grade tracking."
4. **If repeated rejections** (3+ on similar grounds): your account is at risk. Stop publishing on that platform, talk to your account rep (Meta has one once spend exceeds $5k/mo).

---

# Part 14 — Templates and ready-to-fork campaigns

## 14.1 Meta campaign template: Caregiver Nigeria

```
Campaign objective:    App Promotion
Campaign name:         LK_P1_Caregiver_NG_Apr2026
Budget type:           Daily, $10
Bid strategy:          Cost cap, $3 per install

Ad set name:           Caregiver_NG_UrbanCore
Ad set objective:      Install volume
Optimization for:      Installs (later: App Events > StartTrial)

Audience location:     Nigeria > Lagos, Abuja, PH, Ibadan, Kano
Audience language:     English
Audience age:          35 - 65
Audience interests:    Caregiving + Parenting + Family + Mindfulness + Older adults
Audience exclude:      High school education only

Placements:            Automatic (FB feed + IG feed + Reels + Stories + WA Status)

Ad 1:
  Primary text:        "You don't always need to call to know they're okay."
  Headline:            "Watch over your family. Calmly."
  Description:         "Try Leiko free for 7 days. Cancel anytime."
  CTA:                 "Install Now"
  Destination:         Play Store URL
  Creative:            [Midjourney caregiver image 1]

Ad 2:
  Primary text:        "I check Mum's blood pressure from here. Without having to call."
  Headline:            "Real readings. Real watching."
  Description:         "7-day free trial. From $4.99/mo."
  CTA:                 "Install Now"
  Destination:         Play Store URL
  Creative:            [Midjourney caregiver image 2]

Ad 3:
  Primary text:        "A real cuff watch. An app that lets your family see the readings."
  Headline:            "Closer than a phone call."
  Description:         "Try Leiko free for 7 days."
  CTA:                 "Install Now"
  Destination:         Play Store URL
  Creative:            [Runway caregiver video clip, 12s]
```

## 14.2 Meta campaign template: US Diaspora

Same as above, swap:
- Audience location: US (Houston, Dallas, Atlanta, NYC, DC, MD)
- Audience interests: + Nigerian culture + Naija news + Nigerian musicians
- Cost cap: $12
- Daily budget: $10

## 14.3 Google UAC template

```
Campaign type:         App promotion
Goal:                  Install volume
App:                   com.leiko.care
Campaign name:         LK_P1_UAC_NG
Locations:             Nigeria
Languages:             English
Daily budget:          $4
Target CPI:            $3

Asset group 1 — Caregiver:
  Headlines (30 chars max):
    1. "Watch your family's vitals"
    2. "Real cuff, real readings"
    3. "Try Leiko free for 7 days"
    4. "A calmer way to track BP"
    5. "Stay close, even at distance"
  Long headline (90 chars):
    "A clinical-method blood pressure watch with an app your whole family can see."
  Descriptions (90 chars):
    1. "Real cuff watch + family-aware app. Try free for 7 days."
    2. "See readings as they come in. Talk to your doctor with one tap."
    3. "Built for caregivers. Calm. Honest. Real readings."
    4. "Track BP, HR, oxygen, sleep, activity. Plain language."
    5. "Trial free for 7 days, then $4.99/mo. Cancel anytime."
  Images (20 assets):
    - 5× Midjourney caregiver scenes (1200×1200)
    - 5× Midjourney product shots (1200×628)
    - 5× Midjourney trends/insight visuals (1200×1200)
    - 5× clean screenshots from real app
  Videos (3 assets):
    - Runway caregiver clip (15s, 9:16)
    - Runway watch-inflate clip (8s, 16:9)
    - Founder talking to camera (20s, 9:16)
```

## 14.4 A/B test framework

For any ad element you're testing, follow this structure:

1. **Hypothesis**: "Adding 'free' to the headline increases CTR by 20%."
2. **Control**: Existing best ad
3. **Variant**: Same ad with one word changed
4. **Duration**: 7 days minimum
5. **Sample size**: ≥1,000 impressions per variant
6. **Decision criterion**: 95% statistical significance (use Meta's built-in A/B tool)

Don't test multiple variables at once. Don't pause early. Don't read the result before 7 days.

---

# Part 15 — Resources and glossary

## 15.1 Glossary

- **CPM** — Cost per 1,000 impressions
- **CTR** — Click-through rate (clicks / impressions)
- **CPI** — Cost per install
- **CPA** — Cost per action (any custom event)
- **CAC** — Customer acquisition cost (ad spend / paying customers)
- **LTV** — Lifetime value (total revenue per customer)
- **ROAS** — Return on ad spend (revenue / ad spend)
- **UAC** — Universal App Campaign (Google's auto-optimizing app ad format)
- **CAPI** — Conversions API (Meta's server-side event endpoint)
- **MMP** — Mobile Measurement Partner (AppsFlyer, Adjust)
- **SKAN** — SKAdNetwork (Apple's privacy-preserving attribution)

## 15.2 Tools (with my picks bolded)

**Image generation**:
- **Midjourney** ($30/mo Standard)
- DALL-E 3 (in ChatGPT Plus, $20/mo)
- Adobe Firefly (Creative Cloud)

**Video generation**:
- **Runway Gen-3** ($15/mo Standard)
- Pika 2.1 ($10/mo)
- Sora (waitlist)

**Voice**:
- **ElevenLabs** ($22/mo Creator)
- Descript Overdub ($12/mo Hobbyist)

**Music**:
- **Suno v4** ($10/mo Pro)
- Udio ($10/mo)
- Epidemic Sound ($19/mo) — for licensed real music

**Copy**:
- **Claude 4.7** ($20/mo Pro)

**Editing**:
- **CapCut Desktop** (free)

**Attribution (Phase 2+)**:
- AppsFlyer (free tier up to 12K installs/mo)
- Adjust (similar)

## 15.3 Useful reading

- **Andrew Chen** — "Cold start problem" book + andrewchen.com — best founder-level acquisition reading
- **Demand Curve blog** — short tactical ad guides
- **AppsFlyer benchmarks** — industry CAC, retention, LTV by category
- **Meta Blueprint** — free official Meta ad certification training (free)
- **Google Ads Academy** — free official Google Ads training

## 15.4 Useful templates

- This document
- Notion template "Performance Marketing Operating System" (free, search Notion gallery)
- Northbeam Slack community (acquisition specialists, $99/mo)

## 15.5 Founders who've written about this

- Justin Mares (Traction)
- Brian Balfour (Reforge)
- Eric Bahn (Caregiving-app-specific writing)
- AJ Wilcox (LinkedIn-specific, useful if you ever pivot to B2B)

---

## Final word

You'll be tempted to optimize every dial in week 1. Don't. Spend $500-1k learning. Read your data weekly. Iterate creative every 14 days. Trust the algorithms more than your instincts in the first 30 days — they have more data than you.

The Phase 1 → Phase 2 logic gives you the cleanest path from where you are (lean budget, Nigeria inventory, US capital target) to where you want to be (scalable acquisition, both markets, repeatable creative). Stick to it.

When you launch your first campaign, take a screenshot. Stick it on your wall. The first $1 of paid acquisition is a milestone — most founders never get here.

— End of manual —
