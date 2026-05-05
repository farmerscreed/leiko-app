D8a
Self-Buyer Mode Addendum
Amendment to D8 — Design System Specification v1.0
Kena — Caregiver Blood Pressure Monitoring App
Version 1.0
Status: Required reading alongside D8
Prepared for: LawOne Cloud LLC
Date: May 2026
Confidential
This addendum extends D8 to fully support the self-buyer persona (D5 §1.3, D6 §2.3, D6 §4.2 Mode 2). It is not a replacement for D8 — read both together. Every section names the D8 section it amends. If a section in D8 is not amended here, it stands as written.

Document Metadata
Field
Value
Document
D8a — Self-Buyer Mode Addendum
Status
Required reading alongside D8 v1.0 (not a replacement)
Version
1.0
Owner
Founder / Design Lead
Audience
Designers, mobile engineers, copywriters, QA, accessibility reviewer
Source documents
D5 §1.3 (Persona 3), D6 §2.3 (acceptance criteria), D6 §4.2 (Mode 2), D6 US-1 / US-7 / US-8 / US-9, D8 v1.0
Implementation target
Same as D8 — React Native (Expo bare), iOS 15+, Android 9+
Trigger to read this
Any work on onboarding, home, family setup, paywall, or settings flows must read D8 + D8a together
Last updated
May 2026
 
Document Lineage
D5 Brand Brief defines the self-buyer (“Newly-Diagnosed Self-Buyer”) as Persona 3, tertiary
D6 PRD defines Mode 2 (Self-Buyer, single identity) as a v1.0 mode, with acceptance criteria in §2.3 and user stories US-1, US-7, US-8, US-9
D7 TRD locks the data model: users.account_type accepts the ‘self_buyer’ value; the architecture supports it
D8 Design System Specification v1.0 underweighted this persona — §1.4 specified only two users (caregiver + parent)
D8a (this document) closes that gap. It does NOT change D8’s caregiver/parent specifications — it adds a parallel track

Executive Summary
Kena ships v1.0 with a self-buyer mode — Mode 2 in D6 §4.2. The buyer is one identity who is both wearer and watcher: someone recently diagnosed with hypertension who buys the watch for themselves. They may invite family caregivers later (hybrid mode), but at first launch they are alone with their own data.
The self-buyer is a tertiary persona, not the primary buyer. D5 §7.1 deliberately positions Kena in the Caregiver × Warm quadrant. The self-buyer flow exists to capture customers who arrive through Amazon listings, Shopify direct, or partner referrals — not to compete head-on with Omron, Withings, or Hello Heart for the self-monitoring crowd. The bar is: a self-buyer can use Kena well, never that they will love it more than a self-monitoring-first product.
This addendum specifies five things that D8 v1.0 missed:
A first-launch fork between “For someone I care for” and “For myself” (D6 US-1)
A self-buyer onboarding sub-flow with its own headline copy and explainer (US-7, US-8, US-9)
A simplified “You” setup that replaces Family Setup for self-buyers
A Home / Your Readings variant that replaces Family Circle for self-buyers
Self-framed copy across voice templates, push notifications, empty states, and the AI assistant
 
Strategic boundary
D8a does not change D8’s primary positioning. The marketing surface, hero illustrations, paid social ads, and App Store screenshots remain caregiver-led per D5 §8. The self-buyer mode is reachable from inside the product after first-launch fork — but the brand still wins on caregiver positioning. This is intentional: trying to be both “watch over your parent” and “track your own BP” in marketing dilutes both.
Six Decisions That Shape This Addendum
Decision
What it locks
Why
Onboarding forks at screen 1
Single screen with two CTAs; the choice routes the next 6–10 screens
D6 US-1 explicit. The fork must come before any “who are you setting up for” question.
Self-buyer skips Family Setup entirely
No “who you’re looking after” screen; replaced by a one-screen “You” setup
Forcing a self-buyer to invent a parent record is hostile UX. The data model uses a single-row family with the user as both family_owner and parent_owner.
Home becomes “Your Readings”
Single hero card with the user’s own latest reading; trends sit directly below
Family Circle metaphor doesn’t fit. The visual system is identical — only the data shape and titles change.
Voice tone shifts from third-person to second-person
“Your reading”, not “Mum’s reading”
D5 §3.4 forbids the word “patient”. The replacement is direct second-person, never “the user”.
Hybrid path remains open
Settings includes “Invite a family member to follow your readings” at any time
Per D6 §4.2 Mode 2: self-buyer can later invite family caregivers (hybrid case)
Paywall framing shifts from “stay close” to “understand more”
Self-buyer paywall sells AI weekly summaries, doctor-ready PDF, and trend depth — not multi-caregiver
Multi-caregiver is meaningless to a self-buyer. Different value props resonate.
 
What This Addendum Is Not
Not a separate product. It is the same app, same brand, same components — a parallel track triggered by the first-launch fork.
Not a wholesale rewrite of D8. Most of D8 (tokens, components, accessibility, light/dark mode decision, iconography) applies unchanged.
Not a marketing pivot. The website, App Store listing, and paid social remain caregiver-led per D5 §8.
Not a justification to add the self-buyer to App Store screenshots. Those stay caregiver-led.

1. How to Read This Addendum
1.1 The Diff Convention
Every section in D8a uses one of four diff verbs. The verb tells the reader exactly how D8 changes:
Verb
Meaning
Reader behaviour
ADDS
New section, screen, component, or string that D8 did not contain
Implement as new
AMENDS
Existing D8 section is modified — specific sub-sections, fields, or strings change
Apply the diff to the existing implementation
SUPERSEDES
D8 section is replaced entirely for the self-buyer track
Implement two parallel versions — caregiver per D8, self-buyer per D8a
UNCHANGED
D8 section applies as-is to self-buyer mode — stated explicitly so reader can move on
No work — just confirmation
 
When in conflict
For the self-buyer track only, D8a wins over D8. For the caregiver track, D8 always wins. If a section in D8a does not name the diff verb, treat it as ADDS by default and raise a question.
1.2 Routing Rule
At runtime, every screen and string is selected by the user’s account_type field (D7 §3 data model). The selection is binary at v1.0:
account_type = ‘caregiver’ → D8 caregiver track
account_type = ‘self_buyer’ → D8 + D8a (this addendum) for affected sections
account_type = ‘parent’ → D8 parent track (parent users invited by a caregiver — unchanged by this addendum)
 
account_type is set on the onboarding fork (§3 below) and is not editable by the user after that. Switching modes requires support intervention. This is intentional — it forces a clean implementation rather than a leaky toggle.
1.3 Hybrid Mode (Self-Buyer Invites Caregivers)
A self-buyer who invites family caregivers later does NOT become account_type = caregiver. They remain account_type = self_buyer. The change is at the family-level, not the user-level: the family record gains additional family_members with role = caregiver. The self-buyer’s own UI continues to show “Your readings”, not “Family Circle” — the self-buyer is still the protagonist of their own app. The invited caregivers see a Family Circle with one member (the self-buyer-now-watched).
Hybrid asymmetry is intentional
The self-buyer’s view stays self-framed because they own the data and the subscription. The caregivers’ view is family-framed because that’s the metaphor they expect. Both are correct from each user’s vantage point. Engineers: this is two separate React Navigation root stacks, selected by account_type, not a conditional render inside one screen.

2. Self-Buyer Persona Recap
From D5 §1.3 and D6 §2.3. Repeated here so designers and copywriters do not need to flip between documents during build.
2.1 Profile
Attribute
Detail
Age range
35–70 (skews 45–65)
Trigger event
Recent diagnosis of hypertension by a clinician, OR self-recognised concern (family history, recent symptoms, post-pregnancy hypertensive episode that resolved)
Buyer = wearer = watcher
Yes. Single identity covers all three roles
Tech comfort
Mid to high. Same band as caregiver. They are not parent users — large-text mode is opt-in, not default
Geography
US, UK, Nigeria, diaspora. Stronger US weighting than caregiver due to Amazon discovery channel
Distinct emotional posture
Wants understanding, not surveillance. Will NOT tolerate the word “patient” (D5 §3.4)
Likely to invite caregivers
About 30–40% will eventually invite at least one family member, typically a spouse or adult child
Subscription likelihood
Higher per-user than caregiver (less paywall fatigue from family workflows). They are buying for themselves — they decide.
 
2.2 Jobs to Be Done (Self-Buyer)
From D6 §3.3. These four JTBDs drive every screen in this addendum.
#
Job
Implication
JTBD-8 (D6)
I just got told I have hypertension. I want to actually understand what’s happening to my body.
Educational layer is first-class — see D9 (Learn module)
JTBD-S1
I want to take a reading at home and trust the number is real — same as my doctor’s cuff.
Reading detail screen emphasises measurement method (“inflatable cuff, same as your doctor’s” — D5 §6.2)
JTBD-S2
I want to see my trends without being told what they mean by an algorithm.
AI assistant in self-context is opt-in, not pushed. Anomaly banners are softer
JTBD-S3
I want a one-page summary I can show my doctor at my next appointment.
Doctor-ready PDF export is in the paywall feature set for self-buyer specifically
 
2.3 Anti-Patterns Specific to Self-Buyer
In addition to D8 §1.3 (which all apply), the self-buyer track adds these:
Never use the word “patient”. Never use “user” in user-facing copy — always “you”.
Never refer to “your family” in self-buyer onboarding or home. “Your family” only appears after the user actively invites a family member.
Never say “you are at risk”, “we detected”, “you may have”. Reading classification language is descriptive (“Elevated”) not predictive.
Never gamify daily wear with streaks, badges, or progress rings — self-buyers churn fast on apps that turn their condition into a game.
Never auto-show the AI assistant. It must be discoverable and opt-in. A user who just got a diagnosis is not ready to chat with a robot about it.
Never up-sell on the home screen. The paywall fires on the same trigger as caregiver mode (6th reading) — not earlier, even if subscription likelihood is higher.

3. Onboarding Fork (US-1) — ADDS
AMENDS D8 §4.2. ADDS one screen before D8 §4.2.1 (the existing onboarding 1). Renumbers existing onboarding screens.
Routing rule
This is the FIRST interactive screen the user sees after the splash, before sign-in. The choice is captured in local state and persisted on account creation as users.account_type.
3.1 Screen 4.2.0 — Welcome / Path Choice
Field
Value
Audience
Both — the fork itself does not yet know which persona is in front of it
Purpose
Capture the single most important fact about this user: are they buying for someone else, or for themselves?
Layout
Centered single column. Logo at top (96pt). Headline + body. Two stacked primary buttons. No skip.
Headline
Who are you setting up for?
Body
A short, one-line clarifier under the headline.
CTA 1 (top)
Set up for someone I care for — routes to D8 §4.2 onboarding (caregiver track)
CTA 2 (bottom)
Set up for myself — routes to §4 below (self-buyer track)
No back button
This is the first interactive screen — no back exists
Tab bar
Hidden during onboarding
 
3.1.1 Verified Copy
Element
String
Headline
Who are you setting up for?
Body
Kena works for both — the path just looks a little different.
CTA 1 label
Someone I care for
CTA 1 caption (under)
A parent, partner, or other family member
CTA 2 label
Myself
CTA 2 caption (under)
I have or want to track my own blood pressure
 
3.1.2 Component Use (from D8 §3)
Container: standard screen with color.surface.base
Logo: Kena mark, 96pt, centered, color.brand.primary
Headline: type.display-l, color.text.primary
Body: type.body-l, color.text.secondary, max-width 280pt
CTA 1 and CTA 2: button.primary variant for both — NOT primary + secondary. The decision should not visually privilege one over the other.
Spacing between buttons: spacing.l (16pt)
Caption under each CTA: type.caption, color.text.secondary, centered, spacing.xs above
 
Why both CTAs are button.primary
In caregiver-only positioning, the temptation is to make “Someone I care for” the primary (navy) and “Myself” the secondary (outline). This subtly biases self-buyers toward the wrong path. Use button.primary for both — visually equal weight respects the user’s choice.
3.2 Screen 4.2.1 — 4.2.3: Caregiver Onboarding Screens
UNCHANGED from D8. These three screens (“Stay close…”, “Their watch…”, “You drive. They wear.”) only appear after the user picks “Someone I care for” on screen 4.2.0.
3.3 Screens 4.2.4 — 4.2.6: Self-Buyer Onboarding Screens (ADDS)
Three screens parallel to the caregiver onboarding, shown only after “Myself” is chosen on screen 4.2.0. Same visual layout as the caregiver three. Different copy, different illustrations — the emotional register shifts from “stay close” to “understand your body”.
3.3.1 Verified Copy (per D6 US-7, US-8)
Screen
Headline
Body
CTA
4.2.4
Your blood pressure, in your own words.
Kena helps you understand what your numbers mean — in plain language, on your terms.
Continue (button.primary)
4.2.5
Same accuracy as your doctor’s cuff.
The watch uses an inflatable cuff — the same method clinicians use — measured from your wrist instead of your arm.
Continue (button.primary) + Skip (button.ghost)
4.2.6
See your trends. Show them to your doctor.
A clear weekly summary, the kind you can save and share at your next appointment.
Get started (button.accent) + Skip (button.ghost)
 
3.3.2 Illustration Slots
Three new illustrations needed (in addition to the eight in D8 §5.3 inventory). Same style brief: warm cream/amber palette, organic shapes, no clinical/hospital imagery, diverse representation.
Onboarding 4.2.4: A hand resting open, with a soft glow above the wrist (calm self-attention)
Onboarding 4.2.5: A watch beside a stylised arm-cuff, both equally weighted (parity, not replacement)
Onboarding 4.2.6: A hand passing a folded note across a table (the doctor visit, framed warmly)
 
Production note
These illustrations should be commissioned in the same brief and from the same illustrator as the D8 onboarding set. Style consistency between caregiver and self-buyer onboarding is important — they are paths through the same product, not different products.
3.4 Forbidden Phrases in Self-Buyer Onboarding
Per D5 §6.4 forbidden claims plus the self-buyer-specific anti-patterns in §2.3 above. Copy-lint enforces these.
No “patient”, no “user” — always second-person “you”
No “diagnose”, “detect”, “predict” (D5 §6.4)
No “medical-grade” — use “clinically validated” only with citation to the 510(k) IFU
No “take control of your hypertension” — self-help genre cliche; the brand voice is calmer than that
No urgency in onboarding (“don’t wait”, “start today”, “you owe it to yourself”) — calm-before-clever applies even harder for someone reckoning with a new diagnosis

4. Self-Buyer Setup — SUPERSEDES D8 §4.4 (for self-buyer track only)
In the caregiver track, D8 §4.4 (Family Setup) is three screens: You, Who you’re looking after, Watch. In the self-buyer track, the middle screen is removed entirely — there is no separate person to look after. The flow becomes two screens.
Data-model implication (per D7 §3)
When account_type = self_buyer, the app creates a single family record with one family_member where the user is BOTH family_owner AND parent_owner. The watch is paired to this single member. RLS policies in D7 §3 already permit this because role permissions resolve at the membership level, not the user level.
4.1 Screen 4.4.1 (self-buyer variant) — You
Field
Value
Audience
Self-buyer
Purpose
Capture name and timezone in a single short screen
Components
input.text (“What should we call you?”), timezone picker (auto-detected, editable), button.primary “Continue”
Optional
input.text “Year of birth” — helps the AI assistant later; clearly marked optional with skip button
Tone
Reassuring — “Welcome. Let’s set you up.”
Tab bar
Hidden during onboarding
 
4.1.1 Verified Copy
Element
String
Headline
Welcome. Let’s set you up.
Body
A few quick details. We don’t need much.
Name field label
What should we call you?
Name field placeholder
First name is fine
Year-of-birth label
Year of birth (optional)
Year-of-birth helper
Helps us frame your readings in context. You can skip this.
Timezone label
Your timezone
Timezone helper
Auto-detected. Tap to change.
Continue CTA
Continue
 
4.2 Screen 4.4.2 (self-buyer variant) — Watch
Field
Value
Audience
Self-buyer
Purpose
Branch on whether the user already has the watch (per D6 US-9)
Components
Two stacked button.primary CTAs (same visual weight as the onboarding fork in §3.1.2)
CTA 1
I have the watch with me → routes to D8 §4.9 Watch Pairing (caregiver-local path — the user is the local pairing party)
CTA 2
I need to order one → routes to Shopify with email pre-filled, then sets a "watch_pending" flag on the user record so the app shows a friendly waiting state until first reading arrives
 
4.2.1 Verified Copy
Element
String
Headline
Do you have the watch yet?
Body
No problem either way — we’ll guide you through the next step.
CTA 1 label
I have it
CTA 1 caption
Let’s pair it now
CTA 2 label
I need to order one
CTA 2 caption
Takes you to our shop
 
Watch-pending state
If CTA 2 is chosen, the user lands on the home screen with a friendly empty state explaining the watch is on its way. They can still browse Settings, Learn (D9), and the AI assistant. The home reveals normally as soon as the first reading arrives. Tracking link is shown if a Shopify order webhook (D7 §4.6 / ADR-014) confirms shipment.

5. Watch Pairing — UNCHANGED
D8 §4.9 Watch Pairing applies as written. The visual flow, copy, BLE handshake, failure-mode handling and Web Bluetooth fallback (D7 ADR-013) are identical for the self-buyer track. The only behavioural difference: in the self-buyer track, the Web Bluetooth fallback is rarely needed because the user is the wearer — the watch is in the same place as the phone. The fallback path remains in the code for completeness; it is just statistically less hit.
Pairing voice in self-buyer context
D8 §4.9 step 5 success copy says “Paired”. In self-buyer mode this is unchanged. D8 step 1 instruction copy is also unchanged — “Power on the watch” works as second-person already. No copy diff is required.

6. Home / Your Readings — SUPERSEDES D8 §4.5 (for self-buyer track only)
The single most consequential UI change in this addendum. The Family Circle metaphor is replaced by a single-protagonist layout: your latest reading at the top, your trend immediately below, your weekly snapshot below that. No cards-per-parent. No “Add a family member” primary affordance.
6.1 Screen Anatomy
Header bar: app title (“Kena”) on the left, settings gear icon on the right
Anomaly Banner (D8 §3.4) at top if active — self-framed copy variant per §12 below
Hero card: latest reading. Larger than the equivalent caregiver Reading Card. Uses type.numeric-xl (56pt) for BP value. Range chip below. Timestamp.
Below hero: trend mini-chart (last 7 days, BP only, sparkline-style — not the full §3.10 BP Trend Chart). Tap-through to full Trends screen.
Weekly snapshot row: three small stat tiles — “Average”, “In-range %”, “Readings this week”. Each is a list.row.data variant.
Below snapshot: a compact Learn card (per D9) that surfaces one contextual education item based on the latest reading. Auto-rotates daily. Single tap opens the Learn module.
Floating action button (FAB): Take a Reading — button.accent, bottom-right above the tab bar. Triggers the manual-reading flow.
Tab bar: visible. Home tab active.
 
6.2 Hero Card Specification
Region
Content
Token use
Surface
Cream subtle (color.surface.subtle)
radius.m, padding spacing.xl
Top label
"Latest reading" or "Your morning reading" (time-of-day aware)
type.label, color.text.secondary
BP value
e.g. "128/82"
type.numeric-xl (56pt), color.text.primary, tabular monospace
Unit
"mmHg"
type.body-m, color.text.secondary, inline trailing the value
Status chip
In range / Elevated / High (per D6 anomaly logic)
pill.success / pill.accent / pill.urgent (D8 §3.13)
Timestamp
"This morning at 7:42" / "Today, 4:15 pm" / relative format >24h
type.caption, color.text.secondary
HR + SpO2 mini stats
two small inline values, e.g. "HR 72 bpm • SpO₂ 97%"
type.body-s, color.text.secondary
 
6.2.1 Hero Card States
State
Trigger
Visual
fresh
Reading <12h old, in normal range
Default. Status chip = pill.success "In range"
fresh-elevated
Reading <12h old, classifies as Elevated (per D6 anomaly thresholds)
Status chip = pill.accent "Elevated". Single-line educational nudge below ("Worth keeping an eye on.")
stale
Reading 12–72h old
Timestamp uses color.text.secondary; subtle "Time for a new reading?" caption with FAB-equivalent inline link
silent
No reading in >72h
Hero card replaced by an empty-state card with prompt to take a reading
anomaly-noted
Reading triggers anomaly logic
Anomaly banner above replaces inline nudge. Status chip = pill.accent.
confirmed-urgent
>180/120 OR three consecutive >160/100
Crimson left-edge stripe (4pt). Status chip = pill.urgent. The only place crimson appears in self-buyer home.
watch-pending
No watch paired yet, order is being shipped
Hero card replaced by friendly waiting state showing tracking number if available
 
6.3 Verified Copy (per state)
State
Top label
Status chip
Inline nudge / context
fresh (morning)
Your morning reading
In range
(none)
fresh (evening)
Your evening reading
In range
(none)
fresh-elevated
Latest reading
Elevated
Worth keeping an eye on.
stale
Latest reading
—
Time for a new reading? Tap below.
silent
Welcome back
—
It’s been a few days. Want to take a reading now?
anomaly-noted
Latest reading
Elevated
(banner above takes the message; no inline nudge)
confirmed-urgent
Latest reading
High
These last few readings are unusually high. We recommend talking to your doctor today.
watch-pending
Welcome
—
Your watch is on its way. We’ll let you know when it arrives.
 
6.4 Empty Home (No Readings Yet)
When the user has paired the watch but has not yet taken a first reading, the home screen shows an instructional empty state instead of the hero card.
Element
String
Headline
Ready when you are.
Body
Press the side button on your watch and stay still for about a minute. We’ll show your reading here.
CTA
Show me how (opens reading walkthrough — see D9)
 
6.5 Removed Affordances (vs caregiver home)
No "Add a family member" floating button — the equivalent action lives in Settings instead (per §10 below)
No multi-card scrolling list — a single hero plus single trend is the entire screen
No avatar in the header — the user is on their own home, no need to identify which member they’re viewing
No family-side anomaly aggregation logic — the anomaly is always about the user themselves
 
Why a "Take a Reading" FAB on home
Caregiver home does NOT have this affordance because caregivers don’t take readings — the parent does, on the watch. Self-buyers DO take readings (typically twice a day), and the FAB makes that the most accessible action. It triggers the manual-reading walkthrough — it does not start a measurement directly (BP measurement starts on the watch, not the phone).

7. Reading Detail — AMENDS D8 §4.6
Same component anatomy as D8 §4.6. Three diffs apply for the self-buyer track:
7.1 Header
AMENDS: Header replaces "Mum’s reading" / parent-name with "Your reading" + date
Back chevron and date format unchanged
 
7.2 Action Buttons (bottom of screen)
AMENDS: "Mark as not me" (parent-only in caregiver mode) is REMOVED in self-buyer mode — it doesn’t make semantic sense if you are the only person
AMENDS: "Add to weekly note" remains. Renamed: "Note for my doctor"
ADDS: "Why this reading?" — button.ghost. Opens an explainer sheet (per D9 inline explainer spec) that explains the classification of this specific reading in plain language
 
7.3 Comments Section
SUPERSEDES: D8 comment thread (caregiver → caregiver) is replaced by a private notes section visible only to the user
Visual: identical list pattern, but the header reads "My notes" instead of "Comments"
When the self-buyer enters hybrid mode (invites caregivers), THIS notes section remains private. A separate "Family notes" section is added for messages visible to invited caregivers — see §10.4 hybrid mode below
 
Privacy boundary in hybrid mode
In hybrid mode, the self-buyer keeps a private notes channel even after inviting caregivers. This is a deliberate trust feature: the protagonist of the data should always have a private write surface that the watchers cannot see. Per D3 HIPAA-aligned consent flow.

8. Trends — AMENDS D8 §4.7
8.1 Family-member Picker
SUPERSEDES: The horizontal-scrolling family-member picker chip row at the top of D8 §4.7 is REMOVED in self-buyer mode (single member, nothing to pick from)
AMENDS: Header reads "Your trends" instead of family-member name
In hybrid mode (self-buyer + invited caregivers), the picker stays removed on the self-buyer’s side — they only see their own data; caregivers see the picker even with one member because it’s the consistent caregiver UI
 
8.2 Range Selector
UNCHANGED: 7d / 30d / 90d chips (D8 §4.7)
ADDS: a 4th chip "All time" for self-buyer mode — self-buyers care more about their full history than caregivers (caregivers focus on the recent window)
 
8.3 Summary Stats
AMENDS: D8 caregiver summary card shows "average, min, max, anomaly count". Self-buyer card adds: "% in range" as a primary stat (helps the user understand their control trajectory)
ADDS: tap-through on each stat opens a brief explainer (per D9) — e.g., what "average BP" means, what "in-range" means
 
8.4 Doctor-Ready Export
ADDS a feature that does not exist in caregiver mode:
CTA at the bottom of the Trends screen: "Save as PDF for my doctor" (button.secondary)
Generates a one-page PDF with header (name, age, date range), summary stats, the BP trend chart, and a small text section "What I want to discuss" (free-form notes the user typed in §7.3)
Output file: Kena_BP_Report_{YYYY-MM-DD}.pdf, shareable via OS native share sheet (email, AirDrop, WhatsApp, print)
Locked behind paywall (Kena Plus subscription)
 
Doctor-ready export is a paywall lever
Per D6 §4.2 Mode 2 acceptance criteria, the self-buyer wants a one-page summary they can show their doctor. This is the single most compelling paywall trigger for this persona. Designers: do NOT show the export CTA as locked-and-greyed. Show it normal, and reveal the paywall on tap with the framing "Get the full PDF in Kena Plus" (per §9 below).

9. Paywall — AMENDS D8 §4.12
9.1 Trigger
UNCHANGED: Paywall fires on the 6th reading per identity, OR on tapping a paywalled feature
ADDS: New paywalled feature for self-buyer — "Save as PDF for my doctor" (§8.4)
ADDS: Paywalled feature — "All time" range on Trends
 
9.2 Layout
UNCHANGED: full-screen modal, radius.l top corners, three sections (hero, value bullets, price block)
UNCHANGED: button.accent primary CTA, button.ghost secondary "Maybe later"
 
9.3 Hero Headline & Body — SUPERSEDES
Element
Caregiver mode (D8)
Self-buyer mode (D8a)
Hero headline
Stay close, every day
Understand your numbers
Hero body
Kena helps you stay close to your parent’s health — with calm, contextual updates.
See trends clearly. Share them with your doctor. Get plain-language explanations of what your readings mean.
 
9.4 Value Bullets — SUPERSEDES
Three bullets, no medical claims (D5 §6.4). Order matters — the doctor-ready PDF is the lead because it is the single most compelling self-buyer ask.
#
Bullet copy
1
A one-page summary you can save and show your doctor
2
Plain-language explanations of every reading and trend
3
Full history, with no time limit on what you can see
 
9.5 Price Block
UNCHANGED: $4.99/month or $39.99/year USD; 18% savings annotated; 7-day free trial
UNCHANGED: cancel anytime via App Store / Play Store; receipt by email
 
What is NOT in the self-buyer paywall
"Up to 5 family members can stay informed" (the multi-caregiver value prop in D5 §6.2) is NOT mentioned in the self-buyer paywall. Multi-caregiver is meaningless to a self-buyer at first launch. If they upgrade and later invite caregivers (hybrid mode), they discover that capability inside the app — they were not sold on it.

10. Settings — AMENDS D8 §4.11
Same Settings hub structure as D8 §4.11 (Profile, Notifications, Accessibility, Subscription, Privacy, About). Three diffs:
10.1 Profile Section
AMENDS: Field "Year of birth" appears here as editable. In caregiver mode this field belongs to the parent record — in self-buyer mode it lives on the user record itself.
AMENDS: Field "Diagnosed with hypertension?" appears as a 3-state toggle (Yes / No / Prefer not to say). This was captured optionally in onboarding (per D6 US-7) and is editable here.
UNCHANGED: name, photo, timezone, email
 
10.2 Family Section — ADDS
A new section that does not exist in caregiver mode (because caregivers manage family from the home screen). For self-buyers, family management lives in Settings.
Row
Behaviour
Family members
Shows count of invited caregivers ("None yet" / "1 person follows your readings" / "Sarah, John follow your readings")
Invite a family member
Opens an invite-flow bottom sheet — see §10.3 below
Manage who sees my readings
Visible only when at least one caregiver is invited. Routes to a list of caregivers with per-caregiver toggle for "share readings" and "share notes"
 
10.3 Invite-Flow Bottom Sheet (ADDS)
Element
Spec
Surface
Bottom sheet (D8 §3.7), color.surface.elevated
Headline
Invite someone to follow your readings
Body
They’ll see your readings and trends. They won’t see your private notes or your subscription.
Inputs
input.text "Their first name" + input.text or input.email "Their email or phone"
Permission level chip group
"Can see readings" (default) / "Can see readings and add notes" — single-select chips
Primary CTA
Send invite (button.primary)
Secondary
Cancel (button.ghost)
 
10.4 Hybrid Mode — What Changes for the Self-Buyer
Once a self-buyer invites at least one caregiver and the invitation is accepted:
Their home screen UNCHANGED — still "Your readings", still self-protagonist layout. They are not retroactively pushed into the Family Circle metaphor.
Reading detail gains a second notes channel: "Family notes" (visible to invited caregivers) alongside the unchanged private "My notes"
Settings > Family Members count updates
A subtle indicator on the home header bar (small avatar.xs cluster, top-right of the hero card) shows that other people are following — transparency that surveillance is happening
A first-time toast appears the first time a caregiver views the data: "Sarah just looked at today’s reading." — dismissible, never repeats per caregiver
 
Toast policy for transparency
D5 §3.4 says: "Health is shared, not surveilled." The first-view toast is the single concession to that principle in hybrid mode. It does NOT repeat (no toast every time a caregiver opens the app — that creates anxiety on both sides). It is shown once per inviting-caregiver pair, then never again unless permissions change.
10.5 Subscription Section
UNCHANGED structurally
AMENDS: copy lines reflect self-buyer-relevant features (PDF export, full history, plain-language explanations) instead of "share with up to 5 caregivers"
 
10.6 Removed Settings
SUPERSEDES: "Watch shipping & tracking" (D7 ADR-014) appears only briefly during the watch-pending window. Once the user pairs the watch, this disappears — self-buyers don’t need a permanent shipping section.
SUPERSEDES: "Parent quiet hours" timezone setting from D8 caregiver Settings is REPLACED by "My quiet hours" — the self-buyer manages their own quiet hours, no separate parent timezone

11. AI Assistant — AMENDS D8 §4.10
11.1 Discovery
SUPERSEDES: D8 §10 in caregiver mode auto-surfaces the AI assistant after the first anomaly. In self-buyer mode this is REMOVED.
AMENDS: AI assistant is reachable from (a) Settings > Help, (b) the "Why this reading?" button on Reading Detail (§7.2), and (c) explicit Learn module (D9) entry points
Reasoning: a self-buyer reckoning with a new diagnosis should not have an AI proactively chat at them about it
 
11.2 Header
SUPERSEDES: Header context chip "About Mum’s readings" becomes "About your readings" in self-buyer mode
AMENDS: When entered from a specific reading via "Why this reading?", the chip becomes "About your reading from [date]" and the conversation is pre-seeded with that reading’s context
 
11.3 Suggested Prompts (Empty State)
Mode
Suggested prompts
Caregiver (D8 unchanged)
"What does this anomaly mean?" / "How is Mum doing this week?" / "Is 138/86 high?"
Self-buyer (D8a)
"What do my numbers mean?" / "How am I doing this week?" / "Is 138/86 high for someone my age?"
 
11.4 Disclaimer Footer
UNCHANGED: "Kena offers context, not medical advice. Always check with a clinician."
 
11.5 Forbidden Phrases (per D5 §6.4)
UNCHANGED: enforced via copy-lint on prompt template AND output guard (D7 §4)
Reminder: the AI does not say "you may have hypertension", "your numbers suggest", "you are at risk" — all predictive/diagnostic language is filtered
AI says: "this reading is classified as Elevated using the AHA 2017 thresholds" — descriptive, not predictive

12. Voice, Strings & Push Notifications — AMENDS D8 §6 and D8 §8
The single largest copy diff in this addendum. Self-buyer copy uses second-person consistently; caregiver copy uses third-person referring to a parent. Both are valid — they apply to different account_types.
12.1 Tone Mapping
Tone (D8 §1.2)
Caregiver example
Self-buyer example
Reassuring
"All calm this morning. 128/82, within Mum’s usual range."
"All calm this morning. 128/82 — in your normal range."
Informative
"BP changes through the day. Morning readings are usually higher."
"BP changes through the day. Morning readings are usually higher — yours often is."
Calm-Concerned
"We noticed something. Three of Dad’s readings this week were higher than usual. Worth a chat."
"Worth a look. Three of your readings this week were higher than usual. Might be worth talking to your doctor."
Direct (urgent only)
"Three high readings in the last hour. We recommend reaching out to Dad now."
"These last three readings are unusually high. We recommend talking to your doctor today."
 
12.2 Push Notification Templates — SUPERSEDES
Eight categories from D8 §6.6. All have self-buyer variants. Each respects the same quiet hours and length limits (≤120 chars iOS).
Category
Self-buyer title
Self-buyer body
daily-summary
Your morning reading
128/82, in range. Have a good day.
anomaly-noted
Worth a look
Three readings this week were higher than usual. Might be worth a quiet check-in with your doctor.
confirmed-urgent
Please call your doctor
Three high readings in the last hour. We recommend reaching out today.
missed-reading
It’s been a few days
Take a moment to check in with a reading when you can.
family-invite
—
N/A in self-buyer-only mode. Used in hybrid mode (see below).
hybrid-caregiver-joined (ADDS)
Sarah accepted your invite
She can now see your readings.
subscription-billing
Subscription renewing
Kena will renew tomorrow for $4.99/month.
watch-shipped
Your watch is on the way
Tracking #123: arriving Tuesday.
parent-pairing-handoff
—
N/A in self-buyer mode — the self-buyer pairs themselves
 
12.3 Empty State Strings — SUPERSEDES
Screen
Caregiver (D8 §6.4)
Self-buyer (D8a)
Home (no readings yet)
No readings yet — Mum’s watch will start syncing as soon as it’s paired.
Ready when you are. Press the side button on your watch and stay still for about a minute.
Trends (insufficient data)
Trends will appear here next week.
Trends will appear after the first week. Take a reading or two each day.
AI assistant (no history)
Ask anything about Mum’s readings.
Ask anything about your readings.
Family section (no caregivers, self-buyer)
N/A
No one follows your readings yet. Invite someone if you’d like to share.
Notes
Be the first to leave a note.
Notes are just for you, unless you choose to share them.
 
12.4 Error State Strings
UNCHANGED: D8 §6.5 patterns (name the cause without blame, suggest a fix, never a stack trace) apply identically. Most error strings are device- or network-related and do not change between modes.
AMENDS: error strings that mention "the parent’s phone" or "the watch they wear" become "your phone" / "your watch"
 
12.5 Pluralisation & Variables (i18n)
UNCHANGED: ICU MessageFormat per D8 §9.4
AMENDS: variables include {readingCount}, {readingsToday}, {streakDays} — the {parentName} variable is unused in self-buyer mode
AMENDS: the en-NG vs en-US split (Mum vs Mom) is irrelevant in self-buyer mode

13. Component Diffs — AMENDS D8 §3
Five components in D8 §3 need self-buyer variants. None require new visual primitives — only props and content variations.
13.1 Reading Card (D8 §3.3)
AMENDS: parent-name + relationship label (top-row) is REMOVED in self-buyer mode — the card represents the user themselves
AMENDS: avatar (top-right) is REMOVED — same reason
UNCHANGED: BP value, trend indicator, timestamp, anomaly badge, all states
Effective: a smaller-header variant of the same component. New prop: ownerVariant: 'self' | 'parent'
 
13.2 Anomaly Banner (D8 §3.4)
AMENDS: copy variants for self-buyer per §12.1 above
UNCHANGED: visual treatments, severity stacking, dismissal rules
 
13.3 Avatar (D8 §3.9)
UNCHANGED: anatomy and sizes
Note: in self-buyer mode the avatar appears only in Settings and on hybrid-mode caregiver indicator chips. Reading Card and Home do not show the user’s own avatar (no need to identify whose data it is)
 
13.4 BP Trend Chart (D8 §3.10)
AMENDS: range chip set extends from {7d, 30d, 90d} to {7d, 30d, 90d, All}
UNCHANGED: anatomy, interaction, accessibility
 
13.5 Empty State (D8 §3.11)
AMENDS: copy patterns per §12.3 above
UNCHANGED: anatomy, voice rules

14. Edge Cases
14.1 Self-buyer who already has a paired watch and changes mode (does not exist in v1.0)
account_type is set on the onboarding fork and not user-editable. A self-buyer who decides they’d rather use Kena to monitor a parent must contact support, who creates a new account. This is intentional and matches the routing-rule philosophy in §1.2 — it forces a clean implementation rather than a leaky toggle.
14.2 Self-buyer invites a family member who is also a Kena user
Possible scenario: a self-buyer invites their adult daughter, who already has a Kena account because she set Kena up for her own mother. This is supported. The daughter’s account is account_type = caregiver and that does not change. She gains a new family_membership where she is a caregiver of her father (the self-buyer). Her home screen shows two cards now: her mother (existing) + her father (the self-buyer she just got added to). The data model in D7 §3 supports this multi-family case via the family_members table.
14.3 Self-buyer who later wants to change account_type after caregivers join
Cannot. This is a deliberate constraint. The clean path is: leave the self-buyer family (cancel subscription / archive), create a new caregiver account. Support intervention — support documentation should call this out.
14.4 Self-buyer who is also their own caregiver across two devices
Per D7 §6 (auth, family invitations), the same email address can have multiple sessions across devices but represents one identity. A self-buyer who pairs the watch on their phone and then opens the app on a tablet sees the same data, same UI, same self-buyer mode. There is no "second device caregiver mode" — they’re the same user.
14.5 Self-buyer subscription handoff
If a self-buyer cancels their subscription, the doctor-PDF export and full-history Trends become locked. The watch and basic readings continue to work — same paywall philosophy as caregiver mode (basic readings are never paywalled, per D5 §6.2).
14.6 Pregnancy disclosure
On the self-buyer Year-of-birth onboarding (§4.1.1), users who would plausibly be in childbearing age range (no specific cutoff applied — do not gate by age) see a one-time disclosure before completing setup:
Verified disclosure copy
A note about pregnancy: Kena is not validated for use during pregnancy. If you are pregnant or trying to conceive, please use a clinician-recommended upper-arm monitor instead. We will let you know when we add pregnancy support.
Acknowledgement: "I understand" — button.primary
This appears once and is logged to the audit log per D3 (HIPAA-aligned consent)
Self-buyers who change country / region / profile to indicate pregnancy in future can re-trigger this
See D3 amendment for the full Specialised Populations deferral policy

15. Open Design Questions (Self-Buyer Mode)
Resolved before or during Sprint 2 unless noted otherwise.
#
Question
Owner
Target
Default if unresolved
Q-D8a-1
Should the welcome fork (§3.1) be skippable for users who arrive via a caregiver invitation link? They should never see this fork.
Founder + Eng
End of Sprint 2
Yes — invitation link sets account_type=parent before the fork screen renders, fork is skipped
Q-D8a-2
Doctor-ready PDF: ship at v1.0 or v1.1?
Founder
End of Sprint 3
v1.0 — it is the lead paywall lever for self-buyer
Q-D8a-3
Year-of-birth optional or required?
Founder + Clinical
End of Sprint 4 (after clinical advisor hire — Q5 in D7 §14)
Optional at v1.0; revisit when AI assistant context-engineering matures
Q-D8a-4
Should the home FAB "Take a Reading" appear for caregiver mode too if there’s a single parent? (caregiver edge case)
Founder
End of Sprint 5
No — caregivers do not take readings; if they need to, they can use the manual-reading flow from Reading Detail. Kept consistent in caregiver mode.
Q-D8a-5
Hybrid-mode "first-view toast" copy and timing
Founder
End of Sprint 4
Show only on the very first view from each invited caregiver, never repeat
Q-D8a-6
Self-buyer onboarding screen 4.2.6 mentions “save and share at your next appointment”. Is the share surface PDF only, or also a shareable link?
Founder
End of Sprint 5
PDF only at v1.0 (deeplink share is V2 — reduces scope)
Q-D8a-7
Should self-buyer get a “medication tracking” feature given hypertension is a medicated condition?
Founder
V2 review
No at MVP — outside the cleared IFU per D3; medication features are out of scope until clinical/regulatory review
Q-D8a-8
Should self-buyer paywall lead with PDF export or with full-history?
Founder
End of Sprint 3 (test in beta)
PDF export leads, full-history second — per D6 §3.3 JTBD-S3

16. Document Changelog
Version
Date
Changes
1.0
May 2026
Initial issue. Locks self-buyer mode design system, onboarding fork, home / your-readings layout, voice templates, paywall copy, hybrid-mode behaviour, edge cases.
 
Document status
D8a v1.0 is approved for implementation alongside D8 v1.0. Updates to either document are issued with matching minor version numbers (e.g., D8 v1.1 + D8a v1.1) so the addendum stays in lockstep with the trunk.
Approvals
Role
Name
Date
Signature
Founder / Product

Design Lead

Engineering Lead (mobile)

Accessibility Reviewer

— End of D8a —
