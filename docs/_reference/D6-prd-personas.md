> **📎 Historical reference (stamped 2026-06-02).** This is a dated strategy/spec snapshot, kept for context — **not** living spec. For the app's current behaviour see the docs in `docs/00–15`, `docs/04-screens/`, and the decisions in `docs/_adr/`. Where this document and the shipped app disagree, the app + ADRs win.

D6 — Product Requirements Document (PRD) v1.0

**DELIVERABLE 6**

**Product Requirements**

*Leiko Caregiver BP Monitoring App  •  v1.0 (MVP)*

BP Smartwatch Venture  •  LawOne Cloud LLC

*Prepared: May 2026  •  Status: Implementation-Ready*


## **Document Metadata**

|**Deliverable**|D6 — Product Requirements Document (PRD), v1.0 MVP|
| :- | :- |
|**Project**|Leiko Caregiver BP Monitoring App (Urion U16H + U19M white-label)|
|**Entity**|LawOne Cloud LLC (US-registered)|
|**Output Standard**|Implementation-ready. Every requirement traced to D1–D5. Every user story has Given/When/Then acceptance criteria.|
|**Predecessor Documents**|D1 (Competitive), D2 (Unit Economics), D3 (Regulatory), D4 (App Strategy), D5 (Brand Brief)|
|**Successor Documents**|D7 (Technical Requirements Document), D8 (Design System Spec), D9 (Implementation Plan), D10 (Phase 1 Tickets)|
|**Primary Audience**|Engineers (or AI coding agents), QA, designers, founder. Anyone who needs to know WHAT we are building and WHY.|
|**Versioning**|v1.0 = MVP scope. v1.x = post-launch refinements. v2.0 = features deferred from MVP (see §8).|


# **§0 Executive Summary**
This PRD specifies the v1.0 (MVP) of Leiko, a caregiver-first blood-pressure monitoring application that pairs with an FDA-cleared inflatable-cuff smartwatch (Urion U16H / U19M, marketed as Leiko Watch / Leiko Watch Pro per D5 §5.2). The MVP serves the diaspora caregiver as the primary buyer (per D5 §1.1), with secondary support for US Black-American family caregivers (D5 §1.2) and a tertiary path for newly-diagnosed self-buyers (D5 §1.3).

Every requirement in this document is traceable to a source document — D1 (competitive evidence), D2 (unit economics and pricing), D3 (regulatory boundaries), D4 (technical and feature specifications), or D5 (brand voice and audience). Where a requirement is an inference rather than a direct citation, it is explicitly flagged as an assumption with an open question for founder review (see §10).
## **Build Scope at a Glance**

|**Platforms**|iOS 15+ and Android 10+ (per D4 Block 5 — covers ~96% of target audience devices)|
| :- | :- |
|**Languages**|English (US locale) at MVP. Architecture supports localization (per D4 Block 3 + D5 §10.3); additional languages deferred to v2.|
|**Markets**|United States primary (per D2 + D3 — US is the locked launch market). Nigeria distribution via separate channel (D2). UK, Canada deferred.|
|**Device Pairing**|Bluetooth 5.2 LE; one watch ↔ one parent identity; up to 5 caregivers can view (per D4 Block 2.1)|
|**Subscription**|Leiko Plus at $4.99/month or $39.99/year USD (per D2 + D5 §5.3); free tier always shows latest reading + 7-day history|
|**Build Timeline**|18 weeks across three phases (per D4 Block 5). MVP feature-complete at end of Phase 3.|
|**Build Budget**|$35K–$55K (per D4 Block 5 Scenario A — contracted React Native engineer plus part-time backend, plus tooling)|
## **Document Structure**
1. §0 — Executive Summary (this section)
1. §1 — Product Vision
1. §2 — Target Users (3 personas, with implied acceptance criteria)
1. §3 — User Problems and Jobs-to-be-Done
1. §4 — Solution Overview (the watch + the app + the subscription)
1. §5 — Functional Requirements (every user story, organized by feature area)
1. §6 — Non-Functional Requirements (performance, privacy, accessibility, copy compliance)
1. §7 — Out of Scope for v1.0
1. §8 — Success Metrics
1. §9 — Risks and Open Questions
1. §10 — Glossary
1. §11 — Appendix: Traceability Matrix


# **§1 Product Vision**

|<p>**PRODUCT VISION (v1.0 MVP)**</p><p>Leiko lets a caregiver watch over a parent's blood pressure from anywhere in the world. The watch is on the parent's wrist; the app is on the caregiver's phone. Every morning, the caregiver knows how the parent slept, what the parent's blood pressure was, and whether anything needs attention — without asking the parent to remember to call back. We are building this for the millions of diaspora and family caregivers whose love is constrained by geography but whose responsibility is not.</p>|
| :- |

This vision is anchored to D5 §1 (audience), D5 §6.1 (primary message: "Watch over your parents from anywhere in the world"), and D5 §7 (positioning in the empty Caregiver × Warm quadrant of the BP smartwatch category).
## **1.1 Vision Anchors**
1. Caregiver-first, not patient-first. The product's center of gravity is the person watching over the parent. Per D5 §1, the caregiver is the buyer; the parent is the wearer. This decision flows through every feature in §5.
1. Reassurance, not anxiety. Per D5 §3.4, the brand promise is reassurance. The product surface area must reflect this: notifications are calm by default, paywalls do not block essential information, and the AI assistant suggests rather than alarms.
1. Authenticity over generality. Per D5 §1.1, our authenticity moat is the founder's diaspora provenance. This reaches into the product through targeted creative, voice, and onboarding paths — not into the core feature set, which serves all three audiences identically.
1. Regulatory discipline. Per D3, the device is FDA-listed (Class II under K141683) but does NOT carry diagnostic clearance. Every feature, every string of copy, every AI output must respect the boundary. §6.5 enforces this through a forbidden-claims linter.


# **§2 Target Users**
Three personas, all from D5 §1. Each implies acceptance criteria for the product — i.e., things that must be true at v1.0 for that persona to actually adopt the product. Where two personas have conflicting needs, the primary persona (Adaeze) wins.
## **2.1 Persona 1 — "Adaeze" (Primary)**
Diaspora caregiver. Composite from D5 §1.1; built from real data points (NiDCOM 2025 diaspora corridor data, Pew 2024 device ownership, D1 hypertension prevalence in Lagos urban populations). "Adaeze" is a stand-in name — Igbo, meaning "king's daughter" — used here for clarity in scenarios. The brand name is Leiko (D5 §2).

|**Age**|38–52 (sandwich generation)|
| :- | :- |
|**Location**|US (NJ, MD, TX, GA, MA), Canada (ON, AB), UK (London, Manchester)|
|**Career**|Healthcare / IT / professional. Median household $75k–$140k. Often dual-income.|
|**Family Context**|One or both parents live in Nigeria, aged 60+; at least one parent has hypertension. Sends $200–$2,000/month in remittances; 20–40% of that is healthcare-related.|
|**Tech Behavior**|Uses 2–4 diaspora-targeted apps (LemFi, Sendwave, Send, Afriex). Comfortable with $4.99–$14.99/month subscriptions. iPhone primary (60%+).|
|**Emotional Driver**|Guilt-relief and peace-of-mind. Wants to know proactively, not reactively.|
|**Trust Triggers**|Founder authenticity; visible FDA clearance; HIPAA-aligned privacy; fellow-diaspora testimonials; pricing transparent in USD.|
|**Distrust Triggers**|Generic / Chinese-white-label feel; tech burden on the parent; aggressive paywalls; subscription before value is delivered.|
### **Acceptance Criteria for Adaeze (i.e., what MUST be true at v1.0)**
1. She can complete the entire setup flow on her phone in the US, then ship the watch to her mother in Nigeria. She must NOT need to do tech work on her mother's behalf in a different time zone.
1. Her mother in Nigeria can receive the watch, scan a QR code on the box, and have the watch paired and reporting within 5 minutes — without needing to download apps, create accounts, or remember passwords.
1. All app currency is in USD by default. All app text is in English. Localization is deferred but the architecture supports it.
1. The watch, once on her mother's wrist, sends readings to the cloud over Bluetooth + the parent's phone (the parent's existing phone acts as a relay; per D4 Block 4).
1. She receives the daily summary as a push notification on her US phone, even though the watch is in Nigeria.
1. Subscription billing is in USD on her own card, charged to her own account — not to the parent's.
1. She can invite up to 4 other family members (siblings, spouse, adult children) to view the same parent's readings — without them paying separate subscriptions.
1. The app brand voice (per D5 §3) feels authentic to her cultural context but does not exclude non-Nigerian audiences.
## **2.2 Persona 2 — "Marcus" (Secondary)**
US Black-American family caregiver. Per D5 §1.2.

|**Age**|40–58|
| :- | :- |
|**Location**|Atlanta, Houston, DC, NYC, Detroit, Chicago, Charlotte (high Black-American population centers)|
|**Family Context**|Parent in same city or different US state; parent has hypertension. 56% prevalence in Black adults; 72% in 60+ population (D1 / CDC).|
|**Trust Triggers**|Authentic Black families in marketing imagery (not stock with one Black member). Real testimonials. Cultural specificity (e.g., "church mother", "Big Mama").|
|**Distinct from Adaeze**|Both wearer and watcher in same country / time zone. No international shipping or banking. Currency is already USD.|
### **Acceptance Criteria for Marcus**
1. All Adaeze acceptance criteria apply, except those specific to international shipping and time zones.
1. App imagery (App Store screenshots, Shopify hero, paid social ads — per D5 §8) includes authentic Black-American family representation, not just diaspora.
1. Onboarding does NOT assume international family configuration. The sender and receiver of the watch can be in the same household.
## **2.3 Persona 3 — "Newly-Diagnosed Self-Buyer" (Tertiary)**
Same product, different onboarding path. Per D5 §1.3 and D4 Block 2.2.

|**Profile**|Adult (any age) recently diagnosed with hypertension. Buys the watch for themselves. May or may not invite family caregivers later.|
| :- | :- |
|**Distinct Need**|Wants to understand their own data. Wants to share trends with their doctor. Does NOT want "someone watching me" framing.|
### **Acceptance Criteria for the Self-Buyer**
1. Onboarding offers a path: "This watch is for me" — separate from "This watch is for someone I care for". Per D4 Block 2.2 first-60-seconds spec.
1. In self-buyer mode, the watcher and the wearer are the same identity. The app does not require inviting another caregiver.
1. Trends, weekly reports, and "share with doctor" features (per §5.6) are first-class — not buried under family-circle UX.
1. The user can later invite family caregivers without re-onboarding the watch.

|<p>**AUDIENCE DECISION RULE**</p><p>When the product has to choose between optimizing for Adaeze (primary) and one of the other personas, Adaeze wins. When Adaeze and Marcus conflict, Adaeze wins. When Adaeze and the self-buyer conflict, the self-buyer mode is treated as a separate flow rather than a compromise on Adaeze. This decision rule is referenced throughout §5 when feature trade-offs arise.</p>|
| :- |


# **§3 User Problems & Jobs-to-be-Done**
What people are really trying to do when they engage with Leiko. Each job-to-be-done (JTBD) maps to evidence in D1 (what competitors fail at) and D5 (what audiences are trying to accomplish emotionally). The functional requirements in §5 are organized to fulfill these jobs — not to mirror feature lists from competitors.
## **3.1 Caregiver Jobs-to-be-Done**
### **JTBD-1: "When my parent's BP is not okay, I want to know — without having to call them and have them downplay it."**
**Source:** D5 §1.1 ("Wants something proactive, not reactive. Wants to know before being told.") + D1 caregiver-app sentiment research (top complaint about competing solutions: "my parent doesn't tell me when something's wrong").

**Implication for product:** The app must surface anomalies proactively (not require the caregiver to check graphs). Anomaly detection logic (per D4 Block 2.3 Tier B) is a v1.0 must-have, not a v2 nice-to-have.
### **JTBD-2: "I want my parent to wear the watch consistently — without having to remind them every day."**
**Source:** D1 caregiver-app failure mode research; Cognitive Systems / Caregiver Aware research ("Wearables require the person being monitored to remember to wear and charge them — making them unreliable if forgotten"). D4 Block 2.1 (parent UX accessibility rules).

**Implication for product:** The watch + app must provide gentle, non-intrusive reminders. Battery is 10 days (per Urion spec) so charging-anxiety is manageable. Parent UX must be voice-friendly, large-text, and minimal-cognitive-load (D5 §10.4).
### **JTBD-3: "When my parent goes to the doctor, I want to send useful BP data — not 60 days of raw readings the doctor won't read."**
**Source:** D1 — top user complaint about Omron Connect, YHE BP Doctor ("the data is there but it's not in a form I can share"). D4 Block 2.3 Tier C (AI-generated weekly clinical summaries).

**Implication for product:** Weekly clinical summary as a one-page PDF or shareable web link, structured to a clinician's reading habits (averages, outliers, medication-correlated changes). v1.0 must-have.
### **JTBD-4: "I want to involve my siblings without them needing to figure out tech."**
**Source:** D5 §1.1 ("Often part of a family group of caregivers — siblings, spouses"). D4 Block 2.1 multi-caregiver spec.

**Implication for product:** Family-circle invite via a shareable link or phone number. Invitee onboards in 60 seconds. No re-pairing required. v1.0 must-have.
### **JTBD-5: "I want to feel reassured, not surveilled-into-anxiety."**
**Source:** D5 §3.2 (calm voice pillar) + AARP family caregiving research (caregiver burden literature: "caregivers experience higher rates of anxiety than non-caregivers").

**Implication for product:** Push notifications use the "reassuring" tone variant by default (D5 §3.5). Notifications are ratelimited and grouped. The app does not cry wolf. v1.0 must-have, enforced through a string-style linter (§6.5).
## **3.2 Parent (Wearer) Jobs-to-be-Done**
### **JTBD-6: "I want to know my children are okay with me — not that they're hovering."**
**Source:** D5 §3.4 ("Never make the parent feel surveilled"). D5 §10.4 parent-side accessibility.

**Implication for product:** Parent UX shows ME-FIRST framing ("My readings", "My family") rather than "Family is watching". Parent gives explicit consent during pairing and can revoke at any time (HIPAA-aligned).
### **JTBD-7: "I want to take a reading without struggling with technology."**
**Source:** D5 §10.4 ("All text on parent's wrist screen ≥ 24pt; voice-first interactions; high-contrast default"). D4 Block 4 BLE protocol (single-button reading initiation).

**Implication for product:** Reading is one button-press. Result is shown on the watch face in large legible numbers AND announced via on-watch voice (per D4 BLE command 4.13: "Blood pressure announcement by voice"). v1.0 must-have.
## **3.3 Self-Buyer Jobs-to-be-Done**
### **JTBD-8: "I just got told I have hypertension. I want to actually understand what's happening to my body."**
**Source:** D5 §1.3 + D5 §6.2 secondary message C ("Hypertension is what you do every day").

**Implication for product:** Educational layer — explains BP categories (per AHA/ACC 2017 guidelines), what "morning high" means, what medication-correlated drops look like. AI assistant Tier A (D4 Block 2.3) handles "what does this reading mean" without diagnostic claims.

|<p>**JTBD GOVERNANCE RULE**</p><p>Every v1.0 user story in §5 must trace back to one of the eight JTBDs above. If a feature does not serve a JTBD, it is deferred to v2. This rule prevents scope creep during the build.</p>|
| :- |


# **§4 Solution Overview**
The product is three components that together fulfill the JTBDs in §3.
## **4.1 The Three Components**

|**Component**|**Function**|**Source**|
| :- | :- | :- |
|**Leiko Watch (U16H) Leiko Watch Pro (U19M)**|Inflatable-cuff oscillometric BP smartwatch worn by the parent. Measures BP, HR, SpO2, sleep, steps. Streams readings to the parent's phone via BLE 5.2. Battery life 10 days.|D5 §5.2 (naming); D4 Block 4 (BLE protocol); Urion / Alphamed product spec|
|**Leiko App (iOS + Android)**|Mobile application with three modes: (a) Caregiver mode — primary; (b) Parent mode — large-text, voice-first; (c) Self-buyer mode — same as caregiver but watcher==wearer.|D4 Blocks 2 + 3; D5 §10.4|
|**Leiko Plus (subscription)**|$4.99/month or $39.99/year USD. Unlocks AI weekly summaries, multi-caregiver, anomaly detection, full historical trends, and clinician-ready reports.|D2 (pricing); D5 §3.4 (paywall ethics); D5 §5.3 (subscription naming)|
## **4.2 Modes of Use**
### **Mode 1: Caregiver-Wearer Pair (default)**
Caregiver buys, sets up account, ships watch to parent. Parent receives watch, scans QR code, app guides them through pairing. From that point on: parent wears the watch and takes readings; caregiver views readings in their own app on their phone.
### **Mode 2: Self-Buyer (single identity)**
Self-buyer buys the watch, sets up the account, pairs the watch on themselves. Same identity is both wearer and watcher. Per §2.3 acceptance criteria. Self-buyer can later invite family caregivers (becomes a hybrid case where they are both wearer and one of the watchers).
### **Mode 3: Family Circle (multi-caregiver, single wearer)**
Within Mode 1 or after Mode 2 → invite, additional caregivers can be added. Each additional caregiver receives the same readings the primary caregiver does. Up to 5 caregivers per parent (per D4 Block 2.1).
## **4.3 What This MVP Does NOT Do**
Cross-reference §7 (Out of Scope) for the full list. At a glance:

- No web app at MVP. Mobile-only. (Per D4 Block 5.)
- No clinician portal at MVP. Sharing happens via PDF export or shareable link. (Per D4 deferred-to-v2.)
- No medication management beyond logging. No prescription integration. (Per D3 — outside cleared IFU.)
- No diagnostic claims of any kind. (Per D3.)
- No insurance billing or HSA/FSA support at MVP. (Per D2 — D2C cash-pay only at MVP.)


# **§5 Functional Requirements**
Every user story below uses the format: ID, Title, As a / I want to / So that, Source citation, Acceptance Criteria. Acceptance criteria use Given/When/Then format where applicable. Every story traces to D1–D5; where it does not trace cleanly, it is flagged ASSUMPTION.

|<p>**FEATURE AREA INDEX**</p><p>§5.1 Onboarding (US-1 to US-12) | §5.2 Watch Pairing & Parent Setup (US-13 to US-22) | §5.3 Daily Use — Caregiver (US-23 to US-35) | §5.4 Daily Use — Parent (US-36 to US-43) | §5.5 Family Circle (US-44 to US-51) | §5.6 Trends, Reports & Sharing (US-52 to US-58) | §5.7 AI Assistant (US-59 to US-66) | §5.8 Subscription & Paywall (US-67 to US-73) | §5.9 Notifications (US-74 to US-80) | §5.10 Settings & Account (US-81 to US-90) | §5.11 Anomaly Detection (US-91 to US-95)</p>|
| :- |
## **§5.1 Onboarding**
The first 60 seconds determine whether the customer reaches their first reading. Per D4 Block 2.2, three buyer paths converge to a successful pairing event.

**US-1: First launch — choose path**

|**As a**|first-time user opening the Leiko app|
| :- | :- |
|**I want to**|see a clear choice between "This is for my parent" and "This is for me"|
|**So that**|the app routes me through the right setup flow without making assumptions|
|**Source**|*D4 Block 2.2 (first-60-seconds spec); D5 §1.3 (self-buyer mode); D5 §3.4 (voice anti-patterns)*|

**Acceptance criteria:**

- Given the app is launched for the first time on a device, When the user lands on the welcome screen, Then two primary CTAs are visible: "Set up for someone I care for" and "Set up for myself".
- Given the user taps "Set up for someone I care for", Then the app routes them to the caregiver onboarding flow (US-2 onward).
- Given the user taps "Set up for myself", Then the app routes them to the self-buyer onboarding flow (US-7 onward).
- Given the user has already completed onboarding on this device, When the app is launched, Then the welcome screen is skipped entirely and the user lands on the home screen.
- Voice check: copy follows D5 §3 voice pillars — warm, calm, dignified. Never says "patient" or "loved one" — uses "someone I care for" and "myself" per D5 §3.4 anti-patterns.

**US-2: Caregiver — account creation**

|**As a**|caregiver who just chose "set up for someone I care for"|
| :- | :- |
|**I want to**|create an account using my email or social login|
|**So that**|I can save my setup progress and access the app on multiple devices|
|**Source**|*D4 Block 3 (auth stack); D3 (HIPAA-aligned consent flow); D5 §3 (voice)*|

**Acceptance criteria:**

- Given the caregiver path is selected, When the user reaches the auth screen, Then the screen offers: (a) email + magic link, (b) Apple Sign-In on iOS, (c) Google Sign-In on Android.
- Given the user enters an email, When they tap "Continue", Then a 6-digit OTP is sent within 10 seconds and the user can enter it to complete sign-in.
- Given the user signs in with Apple or Google, When auth succeeds, Then a Leiko account is created using the email returned by the provider; no extra registration step is required.
- Given the user has signed in successfully, Then they are taken to US-3 (parent profile setup).
- Privacy: per D3, no health data is collected before consent. Auth screen displays a single privacy link to the privacy policy.
- Voice check: "Welcome." or "Glad you're here." — never "Welcome to the app!" with exclamation (D5 §3.4).

**US-3: Caregiver — parent profile setup**

|**As a**|caregiver who just signed in|
| :- | :- |
|**I want to**|tell the app who I'm caring for (name, relationship, year of birth)|
|**So that**|the app can personalize messages ("your mom", "your dad") and tailor the experience|
|**Source**|*D5 §3.1 (specifics: "your mom" not "loved one"); D4 Block 2.1 (multi-parent constraint)*|

**Acceptance criteria:**

- Given the caregiver completes auth, When they land on "Tell us about who you're caring for", Then they are asked: (a) parent's first name, (b) relationship from a dropdown (Mother / Father / Mother-in-law / Father-in-law / Aunt / Uncle / Grandmother / Grandfather / Other), (c) year of birth.
- Given the caregiver enters "Other" as relationship, Then a free-text field appears for the relationship (e.g., "My godmother").
- Given all required fields are filled, When the caregiver taps Continue, Then the parent profile is saved to the family record and the app proceeds to US-4.
- Given the caregiver wants to add another parent, Then they can do so AFTER finishing the first parent's setup (per §5.5 family circle UX). MVP supports max 2 parents per family.
- Voice: copy uses the relationship the caregiver picked. Throughout the app, push notifications and AI summaries say "your mom Linda" — not "the patient" or "your loved one". Per D5 §3.1, §3.4.

**US-4: Caregiver — explainer of how it works**

|**As a**|caregiver setting up for the first time|
| :- | :- |
|**I want to**|see a 3-step visual explanation of how Leiko works|
|**So that**|I understand what to expect before I order or pair the watch|
|**Source**|*D4 Block 2.2 (onboarding flow); D5 §3, §4.3, §9.2*|

**Acceptance criteria:**

- Given the caregiver lands on the explainer screen, Then 3 steps are displayed visually: (1) The watch goes on Mom's wrist. (2) She takes a reading by pressing one button. (3) You see her readings in this app.
- Given the caregiver scrolls past the explainer, Then they reach US-5 (order or pair flow).
- Voice: copy is reassuring, not feature-list-y. Per D5 §3.5, default tone is "Reassuring".
- Visual: per D5 §4.3, photography is real (multi-generational family). No stock illustrations of robotic doctors or stethoscopes (D5 §9.2).

**US-5: Caregiver — "do you have the watch yet?" branch**

|**As a**|caregiver in onboarding|
| :- | :- |
|**I want to**|tell the app whether I already have the watch or still need to order it|
|**So that**|the app guides me to the right next step|
|**Source**|*D4 Block 2.2; D2 (Shopify D2C channel)*|

**Acceptance criteria:**

- Given the caregiver finishes the explainer, Then they see two CTAs: "I already have the watch" and "I need to order one".
- Given the caregiver taps "I already have the watch", Then the app proceeds to watch pairing (US-13 onward).
- Given the caregiver taps "I need to order one", Then the app opens an in-app browser or external Safari/Chrome view to the Leiko Shopify storefront, with their account email prefilled in the order form.
- Given the caregiver returns to the app after placing an order, Then the home screen displays a "Your watch is on its way" status with the order number and estimated arrival date (manually entered for MVP — no order tracking integration in v1.0; deferred to v2).
- ASSUMPTION FLAG: Order tracking integration with Shopify is deferred to v2. v1.0 displays a static placeholder. Founder must validate this is acceptable. (See §9.)

**US-6: Caregiver — invite parent to pair (when shipping internationally)**

|**As a**|diaspora caregiver who has shipped the watch to my parent overseas|
| :- | :- |
|**I want to**|send my parent a simple link or QR code so they can pair the watch when it arrives|
|**So that**|I don't need to fly home or walk them through tech over the phone|
|**Source**|*D5 §1.1 (Adaeze "shouldn't need parent to do tech work"); D4 Block 2.1 (cross-account pairing)*|

**Acceptance criteria:**

- Given the caregiver indicates the watch will arrive at a different address (parent's address overseas), When the caregiver completes US-3 and US-5, Then the app generates a Pairing Invitation containing: (a) a shareable URL, (b) a QR code, (c) a 6-digit pairing code.
- Given the caregiver shares the invitation with the parent (via WhatsApp, SMS, or email — caregiver's choice), When the parent opens the link or scans the QR code on their phone, Then the parent is taken to a lightweight pairing flow (US-15 onward) without needing to download the app first (web-app fallback for the very first pairing step).
- Given the parent prefers the native app, When they tap "Get the app" on the web pairing page, Then they are taken to the App Store / Play Store and after install, the pairing context is preserved (deep link).
- ASSUMPTION FLAG: Lightweight web-app pairing flow vs. requiring the parent to install the native app — TBD with engineering. Web-app fallback is preferred per Adaeze acceptance criterion (parent shouldn't need to download apps). Defer to TRD for technical feasibility. (See §9.)

**US-7: Self-buyer — account creation**

|**As a**|self-buyer who just chose "set up for myself"|
| :- | :- |
|**I want to**|create an account quickly without being asked who I'm "caring for"|
|**So that**|the app reflects that I'm using it for my own health|
|**Source**|*D5 §1.3, §6.2; D4 Block 2.2*|

**Acceptance criteria:**

- Given the self-buyer path is selected, When the user reaches the auth screen, Then the same auth options as US-2 are offered.
- Given auth succeeds, When the user lands on profile setup, Then they are asked: (a) first name, (b) year of birth, (c) optional: "Have you been diagnosed with high blood pressure?" Yes / No / Prefer not to say.
- Given the user completes profile setup, Then they proceed to a self-buyer-specific explainer (US-8) that frames the product as "Leiko helps you understand your blood pressure" rather than "Watch over your parents".
- Voice: per D5 §6.2 secondary message C — "Hypertension is what you do every day. Leiko helps you actually do it."

**US-8: Self-buyer — explainer**

|**As a**|self-buyer setting up for myself|
| :- | :- |
|**I want to**|understand what Leiko will help me with|
|**So that**|I see clear value before being asked for credit card or watch order|
|**Source**|*D5 §3.5, §6.4 (forbidden claims — must not say "diagnose" or "detect")*|

**Acceptance criteria:**

- Given the self-buyer reaches the explainer, Then 3 panels are shown: (1) "Take a reading from your wrist — same accuracy as your doctor's cuff." (2) "See your blood pressure trends over days and weeks." (3) "Get a one-page summary you can show your doctor."
- Given the self-buyer scrolls past the explainer, Then they reach US-9 (do you have the watch?).
- Voice: per D5 §3.4, never says "patient" or implies the user is being condescended to. Tone is informative + respectful. Per D5 §3.5, this is the "Informative" tone variant.

**US-9: Self-buyer — "do you have the watch yet?" branch**

|**As a**|self-buyer in onboarding|
| :- | :- |
|**I want to**|either pair my watch or order it|
|**So that**|I can complete setup whenever I have the device|
|**Source**|*D4 Block 2.2; D5 §1.3*|

**Acceptance criteria:**

- Same logic as US-5, but routed for self-buyer (no third-party shipping address).
- Given the self-buyer chooses "I need to order one", Then they are taken to Shopify with their account email prefilled.
- Given the self-buyer chooses "I already have the watch", Then they proceed to watch pairing (US-13 onward), but the watch is paired to themselves — wearer == watcher.

**US-10: Caregiver — privacy and consent disclosure**

|**As a**|caregiver who is about to receive my parent's health data|
| :- | :- |
|**I want to**|see a clear, plain-language disclosure of what data is collected, where it lives, and what my parent has consented to|
|**So that**|I trust the product and my parent retains control over their data|
|**Source**|*D3 (HIPAA-aligned consent flow); D4 Block 3 (audit log); D5 §3*|

**Acceptance criteria:**

- Given the caregiver completes US-3 (parent profile), Then a Privacy Disclosure screen is shown with five short paragraphs: (a) what data is collected (BP, HR, sleep, steps); (b) where it lives (encrypted, EU + US, never sold); (c) who can see it (you and any caregivers you invite); (d) your parent's role: they will be asked separately to consent during pairing; (e) how to delete data.
- Given the caregiver acknowledges the disclosure, Then a checkbox "I understand and will share this with my parent" is required before continuing.
- Given the caregiver continues, Then the disclosure version + timestamp is logged to the user's audit log (HIPAA-aligned per D3).
- Voice: per D5 §3.4 — privacy copy is clear and respectful. Never legalistic-only. Per D3, full legal privacy policy is available via a link, separate from this human-readable summary.

**US-11: Caregiver — push notification permission**

|**As a**|caregiver finishing onboarding|
| :- | :- |
|**I want to**|be asked clearly for push notification permission with context|
|**So that**|I understand why notifications matter and I can make an informed choice|
|**Source**|*D4 Block 3 (push stack); Apple HIG / Material Design notification guidelines; D5 §3*|

**Acceptance criteria:**

- Given the caregiver completes US-10 (privacy disclosure), Then a permission-priming screen is shown BEFORE the system permission dialog: "Leiko uses notifications to let you know how Mom did this morning. We'll never spam you, and you can adjust which alerts come through."
- Given the caregiver taps Continue, Then the OS push notification permission dialog is triggered.
- Given the user grants notifications, Then the user is taken to the home screen.
- Given the user denies notifications, Then they are still taken to the home screen, but a banner reminds them they will not receive daily summaries until they enable notifications in Settings.
- Per Apple HIG and Android best practices: never trigger the system permission dialog cold. Always pre-prime.

**US-12: Onboarding — resumable**

|**As a**|user who started onboarding but had to stop partway|
| :- | :- |
|**I want to**|resume from where I left off when I open the app again|
|**So that**|I don't have to start over|
|**Source**|*D4 Block 3; standard mobile UX pattern*|

**Acceptance criteria:**

- Given the user has progressed past auth (US-2 or US-7) but not completed pairing, When they close and reopen the app, Then they land on the next pending onboarding step.
- Given the user has not yet completed auth, When they reopen the app, Then they land on the welcome screen (US-1).
- All onboarding state must persist locally (encrypted at rest per D3) and sync to backend on auth completion.
## **§5.2 Watch Pairing & Parent Setup**
Pairing is the highest-stakes moment in the user journey. Per D1 user research on competitor BP smartwatches, ~30% of users abandon at first pairing. Leiko's pairing flow is engineered to handle: (a) caregiver pairing the watch on themselves, (b) caregiver pairing the watch on a parent in the same room, (c) parent (or someone helping the parent) pairing the watch when received from a remote caregiver.

**US-13: Pairing — start**

|**As a**|user who has the watch in hand|
| :- | :- |
|**I want to**|begin pairing by powering on the watch|
|**So that**|the app discovers the watch and walks me through the rest|
|**Source**|*D4 Block 4 (BLE pairing protocol); D1 (pairing failure rate research)*|

**Acceptance criteria:**

- Given the user reaches the pairing flow (from US-5, US-9, or via shared invitation US-15), Then the screen says "Power on the watch — hold the side button for 3 seconds." with an illustration showing exactly which button.
- Given the watch is powered on and within Bluetooth range, When the app scans, Then any Leiko watches advertising are listed with their last-4-digits-of-MAC for disambiguation.
- Given the watch is detected, When the user taps it, Then the app initiates pairing using the BLE protocol per D4 Block 4.
- Given pairing fails (timeout, watch out of range, multiple watches confusion), Then a diagnostic screen offers: retry, restart watch, or get help (deep link to support).
- Voice: "Power on the watch." — direct and respectful. Per D5 §3.3 (proactive).

**US-14: Pairing — bond and authenticate**

|**As a**|user pairing a watch|
| :- | :- |
|**I want to**|the watch be securely bonded to my account|
|**So that**|no other phone can hijack my watch's data|
|**Source**|*D4 Block 4 (BLE bonding); D3 (security)*|

**Acceptance criteria:**

- Given pairing is initiated (US-13), Then BLE bonding is established with the watch (per D4 Block 4).
- Given bonding completes, Then the watch's UUID is registered in the backend's `devices` table with the user's account ID and a unique device authentication token.
- Given the watch attempts to connect to a different account in the future, Then it cannot — the device-account binding is one-to-one until factory reset.
- Security: per D3, all BLE traffic uses the watch's bonded encryption keys. Watch firmware factory reset (BLE command 0xFF per D4 Block 4.14) is the only way to unbind and re-pair to a new account.

**US-15: Parent — receive invitation and pair**

|**As a**|parent who just received a watch in the mail and a WhatsApp link from my child|
| :- | :- |
|**I want to**|scan or tap the link, and have the watch paired with minimal friction|
|**So that**|I don't have to figure out tech|
|**Source**|*D5 §1.1, §10.4; D4 Block 2.1; D4 Block 4*|

**Acceptance criteria:**

- Given the parent opens the invitation link (URL or QR code per US-6), When they tap it, Then they land on a mobile web pairing flow with: "Hi [Parent's First Name]. Your daughter [Caregiver's First Name] has set up Leiko to help you both watch your blood pressure. Let's pair your watch — it'll take 2 minutes."
- Given the parent confirms, Then the web flow guides them through powering on the watch (US-13 logic) and bonding (US-14 logic) — but using web Bluetooth (where supported) or by directing them to the app.
- Given the parent's browser does not support web Bluetooth, Then the parent is redirected to install the native Leiko app, which detects the pairing context (deep link) and continues automatically.
- Given pairing completes, Then the parent is shown: "You're all set, [Parent's First Name]. Tap the side button on the watch any time you want to take a reading."
- Voice: per D5 §3.4 — parent-facing copy is dignified, never patronizing. Uses parent's first name. Per D5 §10.4, all text ≥ 24pt.
- ASSUMPTION FLAG: web Bluetooth fallback is technically uncertain in Safari iOS (limited support). May default to requiring native app install for parent. TRD must resolve. (See §9.)

**US-16: Parent — explicit consent during pairing**

|**As a**|parent pairing my watch|
| :- | :- |
|**I want to**|explicitly consent to my readings being shared with my caregivers|
|**So that**|I retain control of my own data|
|**Source**|*D3 (HIPAA-aligned consent); D5 §1.1, §3.4; D5 §10.4 (parent UX)*|

**Acceptance criteria:**

- Given pairing is in progress, When bonding completes, Then BEFORE any reading is taken, a consent screen is shown with: "Your blood pressure, heart rate, sleep, and step data will be shared with: [list of caregivers in the family circle, with photos and names]. You can change this any time in Settings. Do you agree?" with two large buttons: "Yes, I agree" / "Not now".
- Given the parent taps "Yes, I agree", Then the consent + timestamp + version are logged to the audit log (HIPAA-aligned per D3).
- Given the parent taps "Not now", Then pairing is rolled back; the watch remains powered on but no readings are streamed. The caregiver receives a push notification: "Your mom paired her watch but hasn't agreed to share readings yet. Talk to her about this when you can."
- Voice: parent-side consent copy is in parent's language (English at MVP; Pidgin / Yoruba / Igbo deferred to v2). Tone is dignified, agency-affirming. Never coercive. Per D5 §3.4.

**US-17: Parent — first reading walkthrough**

|**As a**|parent who just paired the watch|
| :- | :- |
|**I want to**|be guided through my very first reading|
|**So that**|I learn what to expect (cuff inflation, the wait) and feel confident|
|**Source**|*D4 Block 4 (BLE reading); D5 §3.2; per D4 voice on-watch announcement spec*|

**Acceptance criteria:**

- Given the parent has paired and consented (US-16), Then the watch shows a "Take your first reading" prompt and the app shows: "Sit calmly. Press the side button. The cuff will inflate — this is normal. It takes about 45 seconds."
- Given the parent presses the side button, Then the watch initiates a BP measurement via the BLE-equivalent on-watch reading flow.
- Given the reading completes, Then the watch displays SYS / DIA / Pulse in large numerals, and announces the values via on-watch voice (per D4 BLE command 4.13: "Blood pressure announcement by voice"). The reading is also synced to the cloud.
- Given the caregiver in another time zone has not yet seen any reading, Then the FIRST reading triggers a push to all caregivers in the family circle: "Mom just took her first reading. 124/79. She's all set."
- Voice: parent-facing — "Take a deep breath. Press the button. The watch will do the rest." Per D5 §3.2 (calm pillar).

**US-18: Pairing — handle multiple watches in same household**

|**As a**|user pairing my second watch (e.g., for both my parents)|
| :- | :- |
|**I want to**|have the watches correctly distinguished|
|**So that**|I don't accidentally pair the wrong watch to the wrong parent|
|**Source**|*D4 Block 2.1; D4 Block 4*|

**Acceptance criteria:**

- Given a user pairs a second watch, When the BLE scan returns multiple Leiko devices, Then each device is shown with its last-4-digits-of-MAC AND the user is asked to physically confirm by reading the matching code from the watch's pairing screen.
- Given the user enters the wrong physical code, Then pairing is rejected and the user is asked to try again.
- v1.0 supports max 2 paired watches per family (per D4 Block 2.1). Each watch is bound to exactly one parent profile.

**US-19: Pairing — recover from lost-phone or app-reinstall**

|**As a**|user who reinstalled the app or got a new phone|
| :- | :- |
|**I want to**|re-establish my pairing without re-pairing the watch on the parent's wrist|
|**So that**|I don't have to fly home to fix tech|
|**Source**|*D4 Block 4 (BLE recovery); D4 Block 3 (auth + device persistence)*|

**Acceptance criteria:**

- Given the user reinstalls the app and signs in with the same account, When the app starts, Then it queries the backend and pulls down all paired devices and family members for this user.
- Given the watch is on the parent's wrist (still bonded with the previous app instance), Then the new app instance establishes a new BLE connection without re-bonding (using stored device tokens from the cloud).
- Given for some reason the watch lost its bond (e.g., parent's phone reset), Then the user is shown a "Repair watch" flow that walks the parent through powering the watch on and entering pairing mode — done remotely with the parent on a phone call. No physical re-pairing required from the caregiver's end.

**US-20: Pairing — diagnostic info for support**

|**As a**|user whose pairing keeps failing|
| :- | :- |
|**I want to**|share diagnostic info with support to get help|
|**So that**|I'm not stuck without recourse|
|**Source**|*D4 Block 3 (support tooling); D3*|

**Acceptance criteria:**

- Given pairing fails 3+ times, When the user taps "Get help", Then the app collects: (a) phone OS version, (b) Bluetooth state, (c) BLE log of last attempt, (d) watch firmware version (if discoverable), (e) user's account email.
- Given the user consents to share, Then the diagnostic bundle is sent to support@leiko.health (or the chosen support address) with a ticket ID surfaced to the user.
- Privacy: no health data is included in diagnostics. User must explicitly consent. Per D3 + D4 Block 3.

**US-21: Watch — language selection**

|**As a**|parent who prefers English (or another supported language)|
| :- | :- |
|**I want to**|the watch interface to be in my language|
|**So that**|I can read what's on the screen|
|**Source**|*D4 Block 4.1 (BLE language command); D5 §10.3*|

**Acceptance criteria:**

- Given the watch boots for the first time after pairing, When language has not been set, Then the app prompts the caregiver: "What language should the watch display?" with options: English. (V2: Pidgin, Yoruba, Igbo, Spanish.)
- Given the caregiver selects English, Then the watch firmware is set to English via BLE command 4.1 (per D4 Block 4: "Set blood pressure watch time/language").
- v1.0 supports English only. Per D4 Block 3 + D5 §10.3, additional languages are deferred to v2.

**US-22: Watch — time sync**

|**As a**|parent|
| :- | :- |
|**I want to**|the watch to display the correct local time|
|**So that**|I see accurate timestamps|
|**Source**|*D4 Block 4.1*|

**Acceptance criteria:**

- Given the watch is paired, When pairing completes, Then the app sets the watch's clock to the parent's local time via BLE command 4.1.
- Given the parent's location changes (e.g., visits family overseas), When the parent's phone updates timezone, Then the watch's clock is re-synced on next BLE connection.


## **§5.3 Daily Use — Caregiver**
**US-23: Caregiver — home screen / dashboard**

|**As a**|caregiver opening the app on a normal day|
| :- | :- |
|**I want to**|see at a glance how my parent is doing|
|**So that**|I get reassurance in seconds without having to dig through screens|
|**Source**|*D4 Block 2.1 (caregiver dashboard); D5 §3, §6*|

**Acceptance criteria:**

- Given the caregiver opens the app, Then the home screen shows (top to bottom): (a) parent's name and a friendly greeting (e.g., "Mom is doing well today"), (b) most recent BP reading with timestamp, (c) most recent HR reading, (d) sleep summary from last night, (e) a single "How is she trending?" CTA leading to weekly view.
- Given there is more than one parent in the family circle, Then the home screen shows a parent-switcher at the top.
- Given the most recent reading is < 30 minutes old, Then it is labeled "Just now". Older readings show relative time ("2 hours ago", "this morning", "yesterday at 7:14 AM").
- Given there is no reading at all yet (parent just paired but hasn't taken a reading), Then the home screen shows: "Mom paired her watch. We'll let you know when she takes her first reading."
- Voice: per D5 §3 voice pillars; per §6.1 primary message anchored to "Watch over your parents". Reading interpretations follow D5 §3.5 reassuring tone by default.

**US-24: Caregiver — reading detail**

|**As a**|caregiver tapping a reading from the dashboard|
| :- | :- |
|**I want to**|see the reading in context (what the numbers mean, when they were taken, what came before)|
|**So that**|I understand whether to be reassured or pay attention|
|**Source**|*D4 Block 2.1; D5 §3.5, §6.4; AHA/ACC 2017 BP category guidelines*|

**Acceptance criteria:**

- Given the caregiver taps a reading on the dashboard, Then a detail screen shows: (a) SYS / DIA / Pulse in large numerals, (b) timestamp, (c) BP category label per AHA/ACC 2017 guidelines (Normal / Elevated / Stage 1 / Stage 2 / Hypertensive Crisis), (d) a single sentence interpretation in calm tone, (e) the parent's last 5 readings as a small chart, (f) a CTA: "Ask Leiko about this reading".
- Given the reading is in the "Hypertensive Crisis" range (per AHA: ≥180/120), Then the interpretation uses the calm-concerned tone (D5 §3.5) and includes: "This reading is high. We'd suggest a phone call to check on her." — but does NOT use diagnostic language (no "emergency", no "crisis", no "call 911" — per D3 forbidden claims).
- Voice: copy interpretations are pre-written per BP category, in the four voice pillars. Never says "detect", "diagnose", "predict". Per D5 §6.4.

**US-25: Caregiver — recent readings list**

|**As a**|caregiver|
| :- | :- |
|**I want to**|see all recent readings in chronological order|
|**So that**|I can scroll through history without complex filters|
|**Source**|*D2 (free vs. paid tier); D5 §3.4 (don't paywall basic readings — but historical depth is fair to gate)*|

**Acceptance criteria:**

- Given the caregiver taps "Recent readings" from the dashboard, Then a list appears showing the last 30 readings with: timestamp, SYS/DIA/Pulse, and a colored dot indicating BP category.
- Given free-tier user, Then only the last 7 days of readings are shown; an upsell card at the bottom indicates "See full history with Leiko Plus".
- Given Leiko Plus subscriber, Then full history is shown (paginated, infinite scroll), with month/year section headers.

**US-26: Caregiver — manually log a reading**

|**As a**|caregiver|
| :- | :- |
|**I want to**|manually log a reading my parent took with a different device (e.g., the doctor's office cuff)|
|**So that**|the data set is complete in one place|
|**Source**|*D4 Block 2.1; ASSUMPTION on watch-reading deletion policy*|

**Acceptance criteria:**

- Given the caregiver taps "+ Add reading" on the dashboard, Then a form is shown: SYS, DIA, Pulse, Date, Time, Source (dropdown: Doctor's office / Home cuff / Pharmacy / Other), Optional note.
- Given the caregiver submits the form, Then the reading is saved with a clear visual marker (different icon) distinguishing it from watch readings.
- Given the caregiver wants to delete a manually-entered reading, Then they can do so via swipe-to-delete with confirm. Watch readings cannot be deleted — only annotated.
- ASSUMPTION FLAG: Watch readings cannot be deleted by user — only annotated. This is to maintain audit integrity. Confirm with founder.

**US-27: Caregiver — annotate a reading**

|**As a**|caregiver who knows context for an unusual reading|
| :- | :- |
|**I want to**|add a note like "Mom was stressed about the church meeting"|
|**So that**|the AI assistant and the doctor can interpret patterns more accurately|
|**Source**|*D4 Block 2.3 (AI Tier B context windows)*|

**Acceptance criteria:**

- Given the caregiver taps a reading and selects "Add note", Then a text field allows up to 500 chars.
- Given the caregiver saves the note, Then the reading detail (US-24) shows the note inline.
- Given the AI assistant later analyzes patterns (per US-60), Then notes are included in context.

**US-28: Caregiver — request a reading from parent**

|**As a**|caregiver who wants to know how my parent is doing right now|
| :- | :- |
|**I want to**|send a gentle request that prompts my parent to take a reading|
|**So that**|I don't have to call them every time|
|**Source**|*D5 §3.4; D4 Block 2.1*|

**Acceptance criteria:**

- Given the caregiver taps "Request a reading" on the home screen, Then a confirmation modal asks: "Send a gentle reminder to Mom to take a reading?" with a free-text optional message field.
- Given the caregiver confirms, Then the parent's watch and phone receive a notification: "[Caregiver's name] is checking in. Take a reading when you can." Plus the optional message.
- Given the parent dismisses the request without taking a reading, Then nothing breaks; the caregiver is not notified that the request was dismissed.
- Rate limit: max 3 requests per parent per 24h to prevent harassment. Per D5 §3.4 ("Never make the parent feel surveilled").

**US-29: Caregiver — view sleep data**

|**As a**|caregiver|
| :- | :- |
|**I want to**|see how my parent slept last night|
|**So that**|I have context for whether a high morning reading might be sleep-related|
|**Source**|*D4 Block 4.3*|

**Acceptance criteria:**

- Given the parent's watch synced sleep data overnight, Then the home screen shows: total sleep duration, deep sleep duration, light sleep duration, time fell asleep, time woke up.
- Given the parent did not wear the watch overnight, Then the sleep card shows "No sleep data — Mom may not have worn the watch last night."
- Sleep data per D4 BLE command 4.3 ("Reading exercise/sleep information for a certain day").

**US-30: Caregiver — view step / activity data**

|**As a**|caregiver|
| :- | :- |
|**I want to**|see how active my parent has been|
|**So that**|I get a fuller picture of their day|
|**Source**|*D4 Block 4.3 + 4.9 (target parameters)*|

**Acceptance criteria:**

- Given step data is synced, Then the home screen shows today's step count, calories, active minutes.
- Given the parent has goals set (per US-86 settings), Then progress against goals is visualized as a ring (per D5 §4).

**US-31: Caregiver — view SpO2 data**

|**As a**|caregiver|
| :- | :- |
|**I want to**|see my parent's blood oxygen estimates|
|**So that**|I have additional wellness context|
|**Source**|*D4 Block 4.10, 4.11; D3; D5 §6.4*|

**Acceptance criteria:**

- Given the watch's automatic SpO2 measurement is enabled (per US-87 settings + D4 BLE command 4.10), Then SpO2 readings are shown on the dashboard.
- Per D3, SpO2 is labeled clearly as a "wellness oxygen estimate" — NOT "medical-grade" or "clinical". Per D5 §6.4 forbidden claims.
- Given a SpO2 reading is below 92%, Then it is shown without alarm — no anomaly notification triggered. (SpO2 false-low readings are common in wrist optical sensors; per D3 we do not act on them.)

**US-32: Caregiver — view battery and device status**

|**As a**|caregiver|
| :- | :- |
|**I want to**|know if my parent's watch battery is low or if there's a connectivity issue|
|**So that**|I can prompt my parent to charge it before it dies|
|**Source**|*D4 Block 4.2; D5 §3*|

**Acceptance criteria:**

- Given the watch's battery is < 20%, Then the home screen shows a banner: "Mom's watch battery is low (15%). She'll need to charge it soon."
- Given the watch hasn't synced in > 24h, Then the home screen shows: "We haven't heard from Mom's watch since yesterday morning. She might need to charge it." — calm tone, no alarm.
- Battery status per D4 BLE command 4.2.

**US-33: Caregiver — see device firmware status**

|**As a**|caregiver|
| :- | :- |
|**I want to**|know if a firmware update is available|
|**So that**|the watch stays current and secure|
|**Source**|*D3; D4 Block 4 (firmware OTA inferred)*|

**Acceptance criteria:**

- Given a firmware update is available (per backend manifest), Then a non-urgent banner is shown: "A watch update is available. We'll apply it the next time Mom's watch is charging."
- Updates are deferred until the watch is plugged in (charging) AND has > 50% battery — to avoid mid-update battery failure.
- Per D3, OTA firmware updates must preserve clearance status (manufacturer-controlled firmware payloads only).

**US-34: Caregiver — privacy quick-check**

|**As a**|caregiver|
| :- | :- |
|**I want to**|quickly review who has access to my parent's data|
|**So that**|I trust the system|
|**Source**|*D3 (audit + access control); D4 Block 3*|

**Acceptance criteria:**

- Given the caregiver taps the privacy shortcut on settings, Then a list shows: parent's name + every caregiver currently in the family circle, with last-active timestamp.
- Given the caregiver wants to remove a caregiver, Then they can — but only if they are the family owner (per US-44 role model).

**US-35: Caregiver — first-time empty state**

|**As a**|caregiver who just paired the watch but no readings exist yet|
| :- | :- |
|**I want to**|see a friendly empty state instead of a blank dashboard|
|**So that**|I'm not confused or worried|
|**Source**|*D5 §3 (warm tone); D4 Block 2.1*|

**Acceptance criteria:**

- Given no readings exist for the parent, Then the home screen shows: "Mom's watch is paired. As soon as she takes her first reading, we'll show it here." with an illustration (per D5 §4.3 illustration style).
- Given the parent takes the first reading, Then the empty state is replaced with the normal dashboard.


## **§5.4 Daily Use — Parent (Watch + Optional Phone App)**
Parent UX is intentionally simpler than caregiver UX. Per D5 §10.4: large text, voice-first, 3-actions-max per screen, audio readout option.

**US-36: Parent — take a reading**

|**As a**|parent|
| :- | :- |
|**I want to**|take a BP reading by pressing one button|
|**So that**|I get my reading without using the phone|
|**Source**|*D4 Block 4.13 (voice announcement); D5 §10.4*|

**Acceptance criteria:**

- Given the watch is on the parent's wrist, When the parent presses the dedicated side button, Then the watch initiates a BP measurement (per D4 BLE — measurement initiated on-watch firmware, not driven by app).
- Given the cuff is inflating, Then the watch screen shows a calm progress indicator with text: "Sit calmly. Measuring..." in ≥ 24pt.
- Given the measurement completes (~45 sec), Then the watch displays SYS / DIA / Pulse in large numerals AND announces "Your blood pressure is one twenty-four over seventy-nine" via on-watch voice (per D4 BLE command 4.13).
- Given the measurement fails (e.g., movement, poor cuff seal), Then the watch shows "Try again. Sit still and keep the watch firm." Per D5 §3.2 calm tone.

**US-37: Parent — see today's reading on the watch**

|**As a**|parent|
| :- | :- |
|**I want to**|see my most recent reading on the watch face|
|**So that**|I have a quick reference|
|**Source**|*D4 Block 4 (watch face spec inferred)*|

**Acceptance criteria:**

- Given the parent rotates the wrist or taps the watch screen, Then the watch shows the time + last BP reading (or last HR if no recent BP).
- Given no reading has been taken today, Then the watch shows the time only.

**US-38: Parent — phone app (optional, large-text mode)**

|**As a**|parent who wants to see their own data on a phone|
| :- | :- |
|**I want to**|open the Leiko app on my phone in a large-text, simplified mode|
|**So that**|I see my readings clearly|
|**Source**|*D5 §10.4; D4 Block 2.3*|

**Acceptance criteria:**

- Given the parent installs the Leiko app and signs in (using the same account or as a separate "parent identity" within the family), Then they enter Parent mode by default (since their account role is parent\_owner per US-44).
- Given Parent mode is active, Then the UI uses ≥ 24pt body text, ≥ 32pt numerals, high-contrast palette, and a maximum of 3 actions per screen (per D5 §10.4).
- Parent mode shows: today's reading, this week's chart (simplified), button to take a reading, button to view family.
- Parent mode does NOT show: paywalls, subscription upsells, AI assistant chat (deferred to v2 — per D4 Block 2.3 caregiver-first scope).

**US-39: Parent — see the family circle on phone**

|**As a**|parent|
| :- | :- |
|**I want to**|see who is watching over me|
|**So that**|I trust the system and feel agency|
|**Source**|*D3; D5 §1.1*|

**Acceptance criteria:**

- Given Parent mode is active, When the parent taps "My family", Then a list shows each caregiver: name, photo, relationship ("Daughter", "Son", "Daughter-in-law"), last viewed your data: [timestamp].
- Given the parent wants to remove a caregiver, Then they can — and the action is logged + the caregiver is notified by push.
- Per D3 + D5 §1.1 — parent retains data agency.

**US-40: Parent — voice readout**

|**As a**|parent who has trouble seeing fine print|
| :- | :- |
|**I want to**|have my reading read aloud|
|**So that**|I understand it without squinting|
|**Source**|*D5 §10.4; D4 BLE 4.13*|

**Acceptance criteria:**

- Given a reading completes on the watch, Then by default it is announced via on-watch voice (per US-36).
- Given the parent in phone app taps "Read aloud" on a reading, Then the phone speaks the reading using OS TTS.
- Voice readout is enabled by default and can be turned off in Parent settings.

**US-41: Parent — medication reminder (basic)**

|**As a**|parent who takes BP medication|
| :- | :- |
|**I want to**|set a daily reminder|
|**So that**|I take my medication on time|
|**Source**|*D3 (reminder vs. medication management); D4 Block 4 'take medicine reminder' icon shown in spec*|

**Acceptance criteria:**

- Given Parent mode is active, When the parent taps "Medication reminder", Then they can set: medication name (free text), time, days of week, and notification mode (watch buzz + phone push).
- Given the time arrives, Then the watch buzzes (per D4 BLE "medicine reminder" command 4.4 inferred capability) and the phone pushes a notification.
- Given the parent marks taken, Then a log entry is saved.
- Caregiver visibility: caregivers see "Mom marked her morning medication taken at 7:43 AM" in the timeline (per US-29 / dashboard).
- v1.0 supports up to 3 medication reminders per parent. Cross-prescription analysis deferred to v2.
- Per D3, this is a reminder feature — NOT a medication management or interaction-checker tool.

**US-42: Parent — feedback / response to AI insight**

|**As a**|parent|
| :- | :- |
|**I want to**|say "yes that's right" or "no that's wrong" to a question the AI surfaces (e.g., "Was your reading higher because you were stressed?")|
|**So that**|the system gets smarter over time|
|**Source**|*D4 Block 2.3 Tier B; D5 §3.4*|

**Acceptance criteria:**

- Given an AI insight asks for parent feedback (limited to v1.0 — see US-62), Then a simple Yes/No tap is offered with optional voice note.
- Given the parent doesn't respond, Then no nudge is sent. Per D5 §3.4 — never surveilled.

**US-43: Parent — set quiet hours**

|**As a**|parent|
| :- | :- |
|**I want to**|tell the watch and app not to interrupt me at night|
|**So that**|I sleep in peace|
|**Source**|*D4 Block 4 (notification 0x09)*|

**Acceptance criteria:**

- Given Parent mode → Settings → Quiet hours, Then the parent can set start/end times.
- During quiet hours, Then watch buzzes and phone pushes are suppressed (medication reminders excluded — they still fire if scheduled in the window).
- Per D4 BLE "do not disturb setting" command 4.13 (notification 0x09).


## **§5.5 Family Circle (Multi-Caregiver)**
**US-44: Family circle — role model**

|**As a**|system|
| :- | :- |
|**I want to**|the family circle to have well-defined roles|
|**So that**|permissions are predictable and HIPAA-aligned|
|**Source**|*D4 Block 2.1; D3 (HIPAA-aligned access)*|

**Acceptance criteria:**

- Given a family is created, Then four roles exist: family\_owner (creator of the family — typically the primary caregiver), caregiver (additional family members invited to view readings), parent\_owner (the wearer, owns their own data), parent\_viewer (a parent who can see another parent's data — e.g., spouse). Per D4 Block 2.1.
- Permissions: family\_owner can invite/remove caregivers and remove the parent's data on their behalf only with parent's consent. caregiver can view readings + dashboard, send reading-requests, comment on readings. parent\_owner can revoke any caregiver's access at any time + delete their own data. parent\_viewer is read-only.
- MVP supports max 5 caregivers + 2 parents per family.
- Audit log records every role change.

**US-45: Caregiver — invite another caregiver**

|**As a**|primary caregiver|
| :- | :- |
|**I want to**|invite my sibling, spouse, or adult child to view our parent's readings|
|**So that**|we share the responsibility|
|**Source**|*D4 Block 2.1 (multi-caregiver invite)*|

**Acceptance criteria:**

- Given Settings → Family → Invite caregiver, Then a form asks: invitee's first name, relationship to parent, contact (email or phone).
- Given the form is submitted, Then a unique invitation link is generated and can be shared via WhatsApp, SMS, or email (default: WhatsApp deep link if installed).
- Given the invitee taps the link, Then they are walked through a simplified onboarding (US-46) and join the family circle.
- Voice: per D5 §3.4 — "Invite your sister to help watch over Mom" is more specific than "Add another user".

**US-46: Invitee — accept invitation**

|**As a**|person who received an invitation link|
| :- | :- |
|**I want to**|accept and start receiving readings without re-doing all of onboarding|
|**So that**|the friction is low for additional caregivers|
|**Source**|*D4 Block 2.1*|

**Acceptance criteria:**

- Given the invitee opens the link, Then they land on a context screen: "[Inviter's name] has invited you to help watch over [parent's name]. Sign in or create an account to join."
- Given they sign in (using same auth as US-2), Then they are added to the family circle as `caregiver` role.
- Given they are added, Then they immediately see the parent's dashboard with full caregiver permissions (US-44).

**US-47: Caregiver — see other caregivers**

|**As a**|caregiver|
| :- | :- |
|**I want to**|see who else is in the family circle|
|**So that**|I know I'm not alone in this|
|**Source**|*D4 Block 2.1*|

**Acceptance criteria:**

- Given Settings → Family, Then a list shows each caregiver: name, photo (if set), relationship to parent, role label, joined date.
- Given the user is the family\_owner, Then "Remove" buttons are shown next to each caregiver.
- Given the user is not the family\_owner, Then "Remove" buttons are not shown (read-only).

**US-48: Caregiver — leave a family**

|**As a**|caregiver|
| :- | :- |
|**I want to**|leave a family I no longer want to be part of|
|**So that**|I retain control|
|**Source**|*D4 Block 2.1*|

**Acceptance criteria:**

- Given Settings → Family → Leave family, Then a confirm modal explains: "You will no longer see [parent's name]'s readings. This cannot be undone unless [family\_owner] re-invites you."
- Given the caregiver confirms, Then they are removed; the family\_owner receives a push notification: "[Caregiver name] has left the family."

**US-49: Family owner — transfer ownership**

|**As a**|family owner who wants to hand off primary responsibility|
| :- | :- |
|**I want to**|transfer family\_owner role to another caregiver|
|**So that**|the family circle persists past my involvement|
|**Source**|*D4 Block 2.1*|

**Acceptance criteria:**

- Given Settings → Family → Transfer ownership, Then the family\_owner can pick another caregiver in the circle.
- Given confirmation, Then ownership transfers; the previous owner becomes a regular caregiver.
- Audit log records the transfer.

**US-50: Caregiver — react / comment on a reading**

|**As a**|caregiver|
| :- | :- |
|**I want to**|leave a brief comment or reaction on a specific reading|
|**So that**|siblings can coordinate without group-text spam|
|**Source**|*D4 Block 2.1 (multi-caregiver coordination)*|

**Acceptance criteria:**

- Given a reading detail screen (US-24), Then a comment thread is shown below the reading.
- Given a caregiver writes a comment, Then it is shown to all caregivers in the family circle in real-time (sub-2s push delivery target per §6.1).
- Given a caregiver reacts (e.g., 👍 / ❤️), Then the reaction count increments visibly.
- Comments are limited to 280 chars to prevent novel-writing.
- Privacy: comments are not visible to the parent unless explicitly opted in by parent. Default: caregiver-only.

**US-51: Family circle — multiple parents**

|**As a**|caregiver caring for both parents|
| :- | :- |
|**I want to**|have both parents in the same family circle|
|**So that**|I manage them in one place|
|**Source**|*D4 Block 2.1; D3 (independent consent)*|

**Acceptance criteria:**

- Given the caregiver has paired one parent's watch (US-13–17), When they tap "Add another parent" in Family settings, Then they go through US-3 onward for the second parent.
- Given two parents are in the family, Then the dashboard (US-23) shows a parent-switcher.
- Each parent has independent consent, independent data residency, independent caregivers (caregivers can be in both circles or just one).


## **§5.6 Trends, Reports & Sharing**
**US-52: Caregiver — weekly view**

|**As a**|caregiver|
| :- | :- |
|**I want to**|see a weekly view of my parent's BP|
|**So that**|I spot patterns without staring at every reading|
|**Source**|*D2 (free vs. paid tier); D4 Block 2.3 Tier B*|

**Acceptance criteria:**

- Given the caregiver taps "This week" from the dashboard, Then a weekly view shows: average BP, range (lowest/highest), number of readings, and a 7-day chart with morning vs. evening readings color-coded.
- Given fewer than 3 readings exist for the week, Then the view explains: "Mom took fewer readings this week. We need a few more for a useful trend."
- Free tier: this week + previous week. Paid tier (Leiko Plus): unlimited weeks.

**US-53: Caregiver — monthly view**

|**As a**|caregiver / Leiko Plus subscriber|
| :- | :- |
|**I want to**|see a monthly view|
|**So that**|I can see slower-moving trends|
|**Source**|*D2; D5 §3.4*|

**Acceptance criteria:**

- Given Leiko Plus is active, When the caregiver taps "This month", Then a monthly chart shows daily averages over the month with annotations for outlier days.
- Free tier sees an upsell: "See monthly trends with Leiko Plus — $4.99/month."
- Per D5 §3.4 — paywall is on advanced views, not on the latest reading or 7-day history.

**US-54: Caregiver — share with doctor (PDF export)**

|**As a**|caregiver / Leiko Plus subscriber|
| :- | :- |
|**I want to**|generate a one-page PDF of my parent's BP data for the doctor|
|**So that**|the doctor reads useful information in 30 seconds|
|**Source**|*D2; D3; D5 §6.4; D4 Block 2.3 Tier C*|

**Acceptance criteria:**

- Given Leiko Plus is active, When the caregiver taps "Share with doctor", Then they can pick a date range (default: last 14 days) and a destination (email PDF / Open in / Save link).
- Given the PDF is generated, Then it includes: parent's name + DOB, period covered, summary stats (avg BP, range, # readings, days in target), morning vs. evening averages, a chart, top 3 outlier readings with timestamps.
- PDF MUST NOT include any diagnostic interpretation. Per D3 forbidden claims. The doctor reads the data; Leiko does not interpret for the doctor.
- Per D5 §6.4 — language used: "Summary of recent readings — for clinical review". Never "diagnosis", "detected", "abnormal".
- Free tier: deferred — no PDF export in free tier (upsell card).

**US-55: Caregiver — share via shareable web link**

|**As a**|caregiver who wants to share data with a doctor who doesn't accept attachments|
| :- | :- |
|**I want to**|generate a time-limited web link to view the same summary|
|**So that**|any clinician with the link can review|
|**Source**|*D3; D4 Block 2.3*|

**Acceptance criteria:**

- Given the caregiver chooses "Web link" instead of PDF, Then a time-limited (24h or 7d) read-only URL is generated.
- Given the URL is shared, Then anyone with the link can view (no login required), but the link expires after the chosen window.
- Per HIPAA — link contents are minimally identifying (first name + birth year, no full PHI exposed publicly).
- Free tier: deferred.

**US-56: Caregiver — see medication-correlated patterns**

|**As a**|caregiver / Leiko Plus subscriber|
| :- | :- |
|**I want to**|see whether my parent's morning meds are correlating with afternoon BP drops|
|**So that**|I get insight without being a clinician|
|**Source**|*D3; D4 Block 2.3 Tier B; D5 §6.4*|

**Acceptance criteria:**

- Given medication reminders are set (US-41) and at least 14 days of data exist, When the caregiver taps Insights → Medication, Then a comparison view shows: BP averages on days the parent marked medication taken vs. days they did not.
- Per D3 — language is descriptive ("On days Mom took her morning medication, her afternoon readings were on average 8 mmHg lower"). Not prescriptive ("Tell Mom to take her medication every day").

**US-57: Caregiver — export raw data (CSV)**

|**As a**|caregiver / Leiko Plus subscriber|
| :- | :- |
|**I want to**|export raw readings as CSV|
|**So that**|I have my own copy|
|**Source**|*D3 (data portability); D2*|

**Acceptance criteria:**

- Given Leiko Plus, When the caregiver taps Settings → Data → Export, Then a CSV is generated with all readings + metadata and emailed.
- CSV columns: timestamp\_local, timestamp\_utc, sys, dia, pulse, source (watch / manual), note, parent\_name.
- Per D3 — user has a right to data portability.

**US-58: Caregiver — print friendly view**

|**As a**|caregiver|
| :- | :- |
|**I want to**|print a summary|
|**So that**|I can hand a printout to a doctor in person|
|**Source**|*D5 §4.4; D2*|

**Acceptance criteria:**

- Given the user is on the weekly or monthly view, When they tap "Print", Then a print-optimized layout opens in the browser / native print sheet.
- Layout follows D5 §4 brand identity (logo, colors, but B&W-friendly per D5 §4.4).
## **§5.7 AI Assistant**
Per D4 Block 2.3, the AI assistant has three tiers. Tier A: factual lookups & Q&A. Tier B: pattern explanations & gentle insights. Tier C: weekly clinician-ready summaries. v1.0 includes all three. The assistant uses LiteLLM gateway (per D4 Block 3) routing to local Ollama for Tier A, and to Claude Sonnet via API for Tier B/C complex queries.

**US-59: Caregiver — ask the AI assistant**

|**As a**|caregiver|
| :- | :- |
|**I want to**|ask a question in plain language and get a useful answer|
|**So that**|I understand what's happening without searching the internet|
|**Source**|*D4 Block 2.3; D3; D5 §3, §6.4*|

**Acceptance criteria:**

- Given the caregiver taps "Ask Leiko" from the home screen or any reading detail, Then a chat interface opens with: input bar + recent conversation history.
- Given the caregiver types a question, Then the AI responds within 5 seconds (target; per §6.1).
- Given the AI cannot answer (out of scope, ambiguous, or potentially diagnostic), Then it responds: "That's a good question for Mom's doctor. Want help putting it on her next visit list?"
- Per D3 + D5 §6.4 — the assistant NEVER diagnoses, predicts, recommends medication changes, or gives medical advice. Pre-prompts enforce this in the system prompt.
- Per D5 §3 — voice pillars apply to AI output. AI responses must pass the same string-linter as static copy (§6.5).

**US-60: AI — Tier A: factual answer**

|**As a**|system|
| :- | :- |
|**I want to**|Tier A questions to be answered locally without external API call|
|**So that**|latency is low and cost is minimized|
|**Source**|*D4 Block 2.3 Tier A; D4 Block 3 (Ollama)*|

**Acceptance criteria:**

- Given a Tier A question (e.g., "What does diastolic mean?", "What's a normal BP for a 70-year-old?"), Then the answer is generated by local Ollama (per D4 Block 3) using a curated knowledge base.
- Tier A answer time: ≤ 2s p50, ≤ 5s p95.
- Tier A coverage: BP basics, HR basics, sleep basics, watch troubleshooting, app troubleshooting, billing FAQ. Curated content vetted by the founder + (recommended) a clinical advisor before launch.

**US-61: AI — Tier B: pattern explanation**

|**As a**|system|
| :- | :- |
|**I want to**|Tier B questions to access the parent's actual data and explain patterns|
|**So that**|the answer is grounded in the user's reality|
|**Source**|*D4 Block 2.3 Tier B; D3*|

**Acceptance criteria:**

- Given a Tier B question (e.g., "Why was Mom's reading higher this morning?", "How is she trending this week?"), Then the assistant pulls relevant reading context (last 30 days), composes a response via Claude Sonnet API, and replies.
- Tier B answer time: ≤ 5s p50, ≤ 10s p95.
- Tier B context window: max 30 days of readings + manually-entered notes + medication log. Older data not included to keep token cost bounded.
- Per D3 — Tier B responses are interpretive, not diagnostic. The pre-prompt explicitly forbids: prescriptive recommendations, predictive claims, medication advice, urgent-care advice (always defers to "Talk to Mom's doctor").

**US-62: AI — Tier C: weekly summary**

|**As a**|system|
| :- | :- |
|**I want to**|generate a weekly summary on a schedule|
|**So that**|the caregiver gets proactive insight without asking|
|**Source**|*D4 Block 2.3 Tier C; D3*|

**Acceptance criteria:**

- Given Leiko Plus is active for a family, When the weekly cron runs (default: Sunday 6 PM in caregiver's local time), Then the assistant generates a 1-paragraph weekly summary per parent and pushes it to all caregivers in the family.
- Summary structure: "This week, Mom averaged [SYS]/[DIA] over [N] readings. Her morning readings were [trend], her evenings were [trend]. The most notable change was [outlier or pattern]. Have a good week."
- Summary is generated via Claude Sonnet API (Tier C — most context, longest output). Latency tolerance: minutes (background job).
- Per D3 — never diagnostic. Always descriptive.

**US-63: AI — system prompt enforcement**

|**As a**|system|
| :- | :- |
|**I want to**|every AI response to be guard-railed by a non-overrideable system prompt|
|**So that**|regulatory copy compliance is automatic|
|**Source**|*D4 Block 3 (LiteLLM gateway); D3; D5 §6.4*|

**Acceptance criteria:**

- Given any AI request, Then the system prompt prefix (non-overrideable in LiteLLM gateway) includes: D5 voice pillars (Warm, Calm, Proactive, Dignified), the forbidden-claims list (D5 §6.4), and a refusal directive for diagnostic / prescriptive / urgent-care queries.
- Given a user attempts to jailbreak ("Ignore previous instructions..."), Then the system prompt's persistent guardrails prevent diagnostic output. Tested via jailbreak red-team test suite in CI before release.
- Per D3 + D5 §6.4.

**US-64: AI — abuse / cost throttling**

|**As a**|system|
| :- | :- |
|**I want to**|rate-limit AI usage per user|
|**So that**|costs don't run away and abuse is contained|
|**Source**|*D2 (paid tier value); D4 Block 3 (rate limiting)*|

**Acceptance criteria:**

- Given a free-tier user, Then they get 10 Tier A queries per month, 0 Tier B, 0 Tier C.
- Given a Leiko Plus subscriber, Then they get unlimited Tier A, 50 Tier B per month, 4 Tier C (auto-generated weekly).
- Given a user exceeds their quota, Then a friendly message: "You've used all your AI questions for this month. They reset on the 1st." — never a jarring error.

**US-65: AI — caregiver feedback / thumbs**

|**As a**|caregiver|
| :- | :- |
|**I want to**|rate AI responses thumbs-up or thumbs-down|
|**So that**|the system improves|
|**Source**|*D4 Block 2.3 (feedback loop)*|

**Acceptance criteria:**

- Given an AI response, Then thumbs-up / thumbs-down icons appear at the bottom.
- Given the caregiver taps thumbs-down, Then a short feedback form appears: "What was wrong?" with options: Inaccurate / Tone off / Not relevant / Concerning advice.
- Feedback is logged with the response for later review by the founder / clinical reviewer.

**US-66: AI — "talk to Mom's doctor" deflection**

|**As a**|system|
| :- | :- |
|**I want to**|deflect any question that is even slightly diagnostic to the parent's clinician|
|**So that**|we stay safely within FDA boundaries|
|**Source**|*D3; D5 §6.4; D4 Block 2.3*|

**Acceptance criteria:**

- Given a user asks: "Should Mom's medication change?", "Is she having a stroke?", "What does this reading mean for her health?", "Is this dangerous?", Then the AI responds: "That's a question for Mom's doctor. I can help you put it together for her next visit — want me to add it to the share-with-doctor list?"
- Given the user persists, Then the AI repeats with slightly different framing but never crosses the line.
- A regression test suite covers ~50 such adversarial prompts and verifies the deflection rate is 100%.


## **§5.8 Subscription & Paywall**
Per D2: Leiko Plus = $4.99/month or $39.99/year USD. Free tier always shows latest reading + 7-day history (per D5 §3.4). Subscription billing via RevenueCat (per D4 Block 3).

**US-67: Subscription — free tier features**

|**As a**|any user (free)|
| :- | :- |
|**I want to**|use the core product without paying|
|**So that**|I evaluate before committing to a subscription|
|**Source**|*D2; D5 §3.4*|

**Acceptance criteria:**

- Given the user has not subscribed, Then they have access to: latest reading, last 7 days of readings, weekly view (current week + 1 prior), parent dashboard, watch pairing, manual reading entry, basic settings, push notifications for daily summaries, single-caregiver mode (1 caregiver only).
- Per D5 §3.4: free tier MUST always show the latest reading. Never paywalled.

**US-68: Subscription — Leiko Plus features**

|**As a**|Leiko Plus subscriber|
| :- | :- |
|**I want to**|unlock the full feature set|
|**So that**|I get full value for $4.99/month|
|**Source**|*D2; D4 Block 2*|

**Acceptance criteria:**

- Given Leiko Plus is active, Then unlocked: full historical readings, monthly + multi-month trends, AI assistant Tier B + C, anomaly detection (US-91), weekly clinical summaries (US-62), share with doctor (US-54), CSV export (US-57), web link share (US-55), multi-caregiver up to 5, multi-parent up to 2, medication-correlation insights (US-56).

**US-69: Subscription — paywall presentation**

|**As a**|free user encountering a Leiko Plus feature|
| :- | :- |
|**I want to**|see a clear, calm paywall|
|**So that**|I understand the value and decide informed|
|**Source**|*D2; D5 §3.4; standard mobile subscription UX*|

**Acceptance criteria:**

- Given a free user taps a paid feature (e.g., monthly view), Then the paywall screen shows: feature value ("See your mom's monthly trends to spot slow changes"), price ("$4.99/month or $39.99/year — saves 33%"), a 7-day free trial CTA, social proof if available, and a "Maybe later" dismiss.
- Paywall NEVER blocks the latest reading. Per D5 §3.4.
- Voice: per D5 §3 — never aggressive. "Maybe later" works without subtle penalties.
- Free trial: 7 days, no credit card required at start of trial; card collected at trial end if user converts.

**US-70: Subscription — purchase flow**

|**As a**|user starting a Leiko Plus subscription|
| :- | :- |
|**I want to**|complete the purchase via Apple / Google subscriptions|
|**So that**|billing is platform-native and trustworthy|
|**Source**|*D4 Block 3 (RevenueCat); D2*|

**Acceptance criteria:**

- Given the user taps Subscribe, Then the OS native subscription dialog is triggered (StoreKit on iOS, Google Play Billing on Android), routed via RevenueCat per D4 Block 3.
- Given the purchase succeeds, Then the user's account is upgraded to Leiko Plus immediately and the paywall screen they came from auto-converts to the unlocked view.
- Given the user is on Android and the family\_owner is on iOS (or vice versa), Then both platforms accept the subscription tied to the user's Leiko account — not the platform identity. (RevenueCat handles cross-platform.)

**US-71: Subscription — manage / cancel**

|**As a**|Leiko Plus subscriber|
| :- | :- |
|**I want to**|manage or cancel my subscription|
|**So that**|I retain control|
|**Source**|*D2; D5 §3.4*|

**Acceptance criteria:**

- Given Settings → Subscription, Then the screen shows: current plan, next billing date, price, and a "Manage subscription" button that deep-links to OS subscription settings.
- Given the user cancels via OS settings, Then their access continues until the end of the current billing period; on expiry, they revert to free tier with no data loss.
- Per D5 §3.4: cancellation is dignified — no "are you sure?" dark-pattern guilt screens.

**US-72: Subscription — refund handling**

|**As a**|user requesting a refund|
| :- | :- |
|**I want to**|be supported with a clear policy|
|**So that**|I trust the company|
|**Source**|*Industry standard; D2*|

**Acceptance criteria:**

- Apple and Google handle subscription refunds via their stores. Leiko's refund policy (publicly posted) follows: 30-day money-back on annual plans, no refunds on monthly plans (industry standard).
- Customer support responds to refund requests within 24 business hours.

**US-73: Subscription — multi-caregiver billing**

|**As a**|system|
| :- | :- |
|**I want to**|ensure that one Leiko Plus subscription covers the whole family circle|
|**So that**|no double-charging|
|**Source**|*D2; D4 Block 2.1*|

**Acceptance criteria:**

- Given the family\_owner subscribes to Leiko Plus, Then ALL caregivers in the family circle inherit Leiko Plus features for that family.
- Given a non-owner caregiver is in multiple families and one family has Plus, Then they get Plus features only when viewing that family's data.
- Per D2 — single subscription per family circle. Caregivers are not charged separately.
- Edge case: if family\_owner cancels Plus, all caregivers revert to free tier on expiry.


## **§5.9 Notifications**
Per D5 §3.5 voice tone variants. Notifications are categorized so users can fine-tune which categories they receive. Default settings reflect the brand promise: reassurance, not anxiety.

**US-74: Notifications — categories**

|**As a**|system|
| :- | :- |
|**I want to**|notifications to be categorized so users can opt out per-category|
|**So that**|users retain control without losing critical alerts|
|**Source**|*D4 Block 3 (push categorization); D5 §3.5*|

**Acceptance criteria:**

- Notification categories at v1.0: (1) Daily summary (morning report), (2) Weekly summary (Sunday evening), (3) Anomaly (high reading), (4) Watch status (battery low, offline > 24h), (5) Family activity (caregiver joined, comment added), (6) Medication reminder (parent only), (7) Subscription / account, (8) Marketing (off by default).
- Each category has its own iOS notification category + Android channel.
- Settings → Notifications shows each category with toggle + tone preview.

**US-75: Notifications — daily summary**

|**As a**|caregiver|
| :- | :- |
|**I want to**|receive a daily morning summary|
|**So that**|I start the day with context|
|**Source**|*D5 §3.5*|

**Acceptance criteria:**

- Given the parent took at least one reading the day before, Then a notification is sent at the caregiver's local 8:00 AM (configurable in settings, default 8 AM).
- Notification copy template: "Good morning. Mom's reading was [SYS]/[DIA] [time]. She slept [duration]."
- If no readings yesterday: "No readings from Mom yesterday. Want to check in?"
- Voice: per D5 §3.5 reassuring tone.

**US-76: Notifications — weekly summary**

|**As a**|Leiko Plus caregiver|
| :- | :- |
|**I want to**|receive a weekly summary on Sunday evening|
|**So that**|I have proactive insight without asking|
|**Source**|*D4 Block 2.3 Tier C; D5 §3.5*|

**Acceptance criteria:**

- Given Leiko Plus active and ≥ 3 readings during the week, Then the weekly summary (US-62) is generated and pushed at the caregiver's local 6:00 PM Sunday.
- Notification body: first sentence of the AI-generated summary. Tap → opens full summary.

**US-77: Notifications — anomaly alert**

|**As a**|caregiver|
| :- | :- |
|**I want to**|be notified when a reading is significantly outside my parent's normal range|
|**So that**|I notice things I might otherwise miss|
|**Source**|*D5 §3.5; D3; D2; D4 Block 2.3*|

**Acceptance criteria:**

- Given Leiko Plus is active and an anomaly is detected (per US-91 detection logic), Then a notification is sent immediately to all caregivers in the family circle.
- Notification copy template (calm-concerned tone — D5 §3.5): "Mom's reading just now was higher than usual: [SYS]/[DIA]. We've added it to her log."
- Notification NEVER includes panic language. NEVER "emergency". NEVER "call 911". (Per D3 forbidden claims.)
- Free tier: anomaly alerts deferred (per D2 — paid feature). Free tier user sees the high reading on dashboard but no proactive push.

**US-78: Notifications — quiet hours and rate limiting**

|**As a**|system|
| :- | :- |
|**I want to**|respect caregiver quiet hours and not over-notify|
|**So that**|we don't become noise|
|**Source**|*D5 §3.4 (don't over-notify); industry best practice*|

**Acceptance criteria:**

- Default quiet hours: 10 PM – 7 AM caregiver local time. Adjustable in settings.
- During quiet hours, only Anomaly Critical alerts are delivered (and only if user opted in to override quiet hours for anomalies). Other categories are batched and delivered at end of quiet hours.
- Maximum 3 notifications per category per 24h. Excess are batched.

**US-79: Notifications — deep links**

|**As a**|caregiver tapping a notification|
| :- | :- |
|**I want to**|land directly in the relevant screen|
|**So that**|I get to context in one tap|
|**Source**|*Standard mobile UX*|

**Acceptance criteria:**

- Daily summary tap → home dashboard.
- Weekly summary tap → weekly view (US-52).
- Anomaly tap → reading detail (US-24).
- Watch status tap → device settings.
- Family activity tap → family screen (US-47).
- Medication reminder tap → medication detail.
- Subscription tap → subscription settings.

**US-80: Notifications — accessibility**

|**As a**|user with VoiceOver / TalkBack enabled|
| :- | :- |
|**I want to**|notifications to be properly read by assistive tech|
|**So that**|I can use the product|
|**Source**|*D5 §10; WCAG 2.2 AA*|

**Acceptance criteria:**

- Notification body must be a complete sentence (not just a number). Per D5 §10.
- Notification title and body are tested with VoiceOver and TalkBack before each release.


## **§5.10 Settings & Account**
**US-81: Settings — top-level structure**

|**As a**|user|
| :- | :- |
|**I want to**|find every setting in a logical place|
|**So that**|the experience is predictable|
|**Source**|*Standard mobile UX*|

**Acceptance criteria:**

- Settings is divided into: Account, Family, Devices, Notifications, Privacy & Data, Subscription, Help, About.
- Each section is its own screen reachable from a single Settings home.

**US-82: Settings — account**

|**As a**|user|
| :- | :- |
|**I want to**|view and edit my account details|
|**So that**|my data is correct|
|**Source**|*D3 (data deletion rights); D4 Block 3*|

**Acceptance criteria:**

- Account screen: email (with re-verification flow if changed), display name, photo, year of birth, sign-in methods, sign out, delete account.
- Delete account: 30-day grace period during which user can restore. After 30 days, full deletion per D3.

**US-83: Settings — family**

|**As a**|user|
| :- | :- |
|**I want to**|manage my family circle|
|**So that**|I retain control|
|**Source**|*D4 Block 2.1*|

**Acceptance criteria:**

- Family screen surfaces: list of caregivers (per US-47), list of parents in family, invite caregiver button, leave family button (US-48), transfer ownership (US-49 — owner only).

**US-84: Settings — devices**

|**As a**|user|
| :- | :- |
|**I want to**|see and manage paired devices|
|**So that**|I troubleshoot easily|
|**Source**|*D4 Block 4.14*|

**Acceptance criteria:**

- Devices screen shows: each paired watch with serial / name ("Mom's watch"), last sync time, battery, firmware version, unpair button.
- Unpair: requires confirmation. Triggers BLE factory reset on watch (per D4 Block 4.14).

**US-85: Settings — notifications**

|**As a**|user|
| :- | :- |
|**I want to**|fine-tune which notifications I receive|
|**So that**|the app stays useful without becoming noisy|
|**Source**|*D4 Block 3*|

**Acceptance criteria:**

- Notifications screen lists each category from US-74 with toggles. Default state: all on except Marketing.
- Quiet hours configurable here.
- Test notification button per category for verification.

**US-86: Settings — parent preferences**

|**As a**|caregiver / parent|
| :- | :- |
|**I want to**|set parent goals and preferences|
|**So that**|the watch fits the parent's life|
|**Source**|*D4 Block 4.4, 4.9*|

**Acceptance criteria:**

- Parent prefs: target step count, target sleep hours, BP target range (informational only — per D3 we cannot set medical targets), height, weight, age, gender, strap size.
- These propagate to the watch via D4 BLE command 4.4 ("Setting Time Format / Metric/Imperial / User Parameters").

**US-87: Settings — automatic measurements**

|**As a**|caregiver / parent|
| :- | :- |
|**I want to**|enable or disable automatic background HR and SpO2|
|**So that**|I balance battery vs. data|
|**Source**|*D4 Block 4.7, 4.10*|

**Acceptance criteria:**

- Automatic HR toggle (default on) — per D4 BLE 4.7.
- Automatic SpO2 toggle (default on) — per D4 BLE 4.10.
- BP measurements are manual only — automatic BP is not supported by the device hardware (cuff inflation requires user initiation).
- Toggles propagate to watch firmware via BLE.

**US-88: Settings — privacy & data**

|**As a**|user|
| :- | :- |
|**I want to**|see, export, and delete my data|
|**So that**|I have data agency per HIPAA|
|**Source**|*D3*|

**Acceptance criteria:**

- Privacy screen: View what's collected (link to plain-language disclosure), Export my data (link to US-57), Delete my data (account deletion + grace period), Audit log (link to US-90), Consent log.

**US-89: Settings — language and region**

|**As a**|user|
| :- | :- |
|**I want to**|set my preferred language and region|
|**So that**|the app fits my context|
|**Source**|*D4 Block 3; D5 §10.3*|

**Acceptance criteria:**

- v1.0: language defaults to device locale. English supported. Other languages stubbed but disabled.
- Region: defaults to device region. Affects BP unit (mmHg fixed in v1.0), date format, currency display in subscription view.

**US-90: Settings — audit log access**

|**As a**|user|
| :- | :- |
|**I want to**|see who has accessed my data when|
|**So that**|HIPAA compliance is auditable|
|**Source**|*D3 (HIPAA audit log); D4 Block 3*|

**Acceptance criteria:**

- Audit log shows last 90 days of: who logged in, who viewed which reading, who shared what with the doctor, role changes.
- Available to family\_owner and parent\_owner. caregivers see their own activity only.


## **§5.11 Anomaly Detection**
Per D4 Block 2.3 Tier B. Anomaly detection runs on every incoming reading and triggers proactive notifications when warranted. Critical: per D3, language is descriptive ("higher than usual"), not diagnostic ("hypertensive"). Detection logic is statistical, not clinical.

**US-91: Anomaly — definition and detection**

|**As a**|system|
| :- | :- |
|**I want to**|detect statistical outliers in BP readings|
|**So that**|the caregiver is informed of meaningful changes|
|**Source**|*D4 Block 2.3 Tier B; D3; AHA/ACC 2017 (informs absolute thresholds)*|

**Acceptance criteria:**

- Given a new reading is recorded, When the system has at least 14 days of baseline for that parent, Then it computes: rolling average ± 2 standard deviations.
- Given a reading falls outside ± 2σ AND exceeds an absolute threshold (SYS > 150 or DIA > 95 or pulse > 120), Then it is classified as Anomaly.
- Given baseline is < 14 days, Then absolute thresholds only are used (SYS > 160, DIA > 100, pulse > 130).
- Detection is computed server-side on reading ingest. Latency target: < 5s from reading sync to anomaly notification.
- Per D3: anomaly = statistical outlier. NOT "hypertensive crisis", NOT "dangerous". The caregiver decides what to do; the product provides the signal.

**US-92: Anomaly — notification copy**

|**As a**|system|
| :- | :- |
|**I want to**|anomaly notifications use calm-concerned tone|
|**So that**|we maintain brand promise|
|**Source**|*D5 §3.5; D3*|

**Acceptance criteria:**

- Given an anomaly is triggered, Then notification body uses one of three pre-approved templates (D5 §3.5):
- Template 1: "Mom's reading just now was higher than usual: [SYS]/[DIA]. We've added it to her log."
- Template 2: "Mom's morning reading was elevated: [SYS]/[DIA]. The past few mornings have been higher than her usual range."
- Template 3: "A few of Mom's readings this week have trended higher. Worth a check-in when you can."
- Selection logic: 1 = single outlier, 2 = morning trend, 3 = weekly trend.

**US-93: Anomaly — false positive control**

|**As a**|system|
| :- | :- |
|**I want to**|minimize anomaly fatigue|
|**So that**|caregivers don't tune out alerts|
|**Source**|*D4 Block 2.3*|

**Acceptance criteria:**

- Given an anomaly was just flagged, Then the next anomaly within 4 hours is suppressed (deduplication).
- Given the parent is in a known elevated context (e.g., manually annotated "Mom was stressed"), Then sensitivity is reduced for the next 24 hours.
- Caregiver feedback (US-65 thumbs) tunes the model over time per family.

**US-94: Anomaly — escalation policy**

|**As a**|system|
| :- | :- |
|**I want to**|have a clear escalation policy when anomaly trends worsen|
|**So that**|we don't sit silent on serious patterns|
|**Source**|*D3*|

**Acceptance criteria:**

- Given 3+ anomalies in 7 days, Then the weekly summary (US-62) emphasizes the trend and includes: "Three readings this week were notably higher than Mom's usual range. This is worth a call to her doctor — would you like help drafting a message?"
- Per D3: "would you like help drafting a message" is acceptable. "Call 911" is not. "Tell her doctor immediately" is not (urgency framing crosses into prescriptive territory).

**US-95: Anomaly — feature gate**

|**As a**|system|
| :- | :- |
|**I want to**|anomaly detection only available to Leiko Plus subscribers|
|**So that**|we maintain pricing rationale|
|**Source**|*D2; D5 §3.4*|

**Acceptance criteria:**

- Free tier users see the reading on the dashboard (per US-67) but no proactive anomaly push.
- On the dashboard, an unobtrusive note: "Get proactive alerts with Leiko Plus".
- Per D2 + D5 §3.4 — paywall is on advanced features, not on basic data.


# **§6 Non-Functional Requirements**
## **§6.1 Performance**

|**Metric**|**Target**|**Source**|
| :- | :- | :- |
|App cold start|≤ 2s p50, ≤ 4s p95|D4 Block 3; mobile UX standard|
|App warm start|≤ 0.5s p50|D4 Block 3|
|BLE pairing time (first-time)|≤ 60s p50 from "power on watch" to "paired & ready"|D4 Block 4|
|BLE reading sync (incremental)|≤ 10s for the latest reading after watch comes in range|D4 Block 4|
|Push notification delivery|p50 ≤ 5s, p95 ≤ 30s from server emit to device|D4 Block 3; APNs/FCM SLAs|
|AI Tier A response time|≤ 2s p50, ≤ 5s p95|D4 Block 2.3|
|AI Tier B response time|≤ 5s p50, ≤ 10s p95|D4 Block 2.3|
|Reading anomaly detection|≤ 5s from reading sync to anomaly classification|§5.11|
|Dashboard render|≤ 1s on a mid-tier device with 30 days of cached data|UX standard|
|Battery impact (caregiver phone)|≤ 3% per day in normal use (no foreground BLE)|Mobile UX standard|
|Watch battery life|≥ 10 days typical use, ≥ 7 days if 5+ BP readings/day|Urion / Alphamed spec; D5 §6.3|
## **§6.2 Privacy & Security**
1. HIPAA-aligned data handling. Per D3 + D4 Block 3. Encryption at rest (AES-256) on all backend stores. Encryption in transit (TLS 1.3) between app and backend, and between backend and AI providers.
1. Data residency: caregiver and reading data stored in US (primary) and EU (replica) per D4 Block 3. No data residency in China or Russia.
1. Authentication: email + magic link, Apple Sign-In, Google Sign-In. JWT-based sessions with refresh tokens. Refresh on 30 days; force re-auth on 90 days of inactivity.
1. Authorization: row-level security (RLS) on all Supabase tables. Every read and write checks the user's role in the family circle. Audit log records every read with non-empty resultset.
1. Access control: family\_owner, caregiver, parent\_owner, parent\_viewer per US-44. RLS enforces.
1. Audit log: every read/write of health data is logged with timestamp, actor, action, target. Retained 90 days minimum, 7 years for any data accessed by a user with HIPAA-covered-entity provider in the loop (deferred to v2).
1. Data deletion: user-initiated deletion with 30-day grace period. After grace period, full deletion within 30 days (60 days max from initial request).
1. Third-party data sharing: NONE. Per D4 Block 3 — analytics is self-hosted PostHog; AI is via LiteLLM gateway with no PHI passed to LLM providers (PII stripped before sending).
1. AI provider data handling: any PHI in AI Tier B/C requests must be de-identified or use BAA-covered API endpoints. Anthropic offers BAA on Claude API for healthcare; this must be in place before launch (open item in §9).
1. Vulnerability management: dependency scanning in CI (npm audit / Snyk). Annual penetration test (deferred to post-launch unless MVP user count exceeds 1000).
## **§6.3 Accessibility (WCAG 2.2 AA)**
1. All text contrast meets AA (4.5:1 body, 3:1 large text). Per D5 §10.1 — verified palette.
1. Dynamic Type support on iOS; supports 100%–200% scaling without breaking layout.
1. Android: support OS-level font size scaling 1.0x – 1.3x without breaking.
1. VoiceOver labels on every interactive element. TalkBack labels on every interactive element.
1. Color is never the sole signal. Anomaly indicators always combine color + icon + text.
1. Reduced motion: animations gated behind `UIAccessibilityIsReduceMotionEnabled`. Subscribers in reduced motion mode see static transitions.
1. Keyboard / external accessory navigation supported on iPad / Android tablet form factors (deferred from MVP — flag in §9).
1. Parent UX (per D5 §10.4): ≥ 24pt text, ≥ 32pt numerals, voice readout, ≤ 3 actions per screen, high-contrast default theme.
## **§6.4 Localization Readiness**
1. All user-facing strings are externalized in i18n resource files. NO hardcoded strings (string-linter enforces in CI).
1. Date, time, number, and currency formatting uses ICU MessageFormat patterns.
1. RTL layout support is wired but disabled at MVP (no RTL languages shipped). Architecture supports it for v2 Arabic / Hebrew.
1. v1.0 ships English (US) only. Translation pipeline established for v2 (Pidgin, Yoruba, Igbo, Spanish — per D5 §10.3).
1. Voice copy in additional languages must be reviewed by a native speaker AND a clinical reviewer to maintain D3 forbidden-claims discipline. (Translation is not a one-step process; flagged in §9.)
## **§6.5 Regulatory Copy Compliance**

|<p>**FORBIDDEN-CLAIMS LINTER (CRITICAL)**</p><p>A static-analysis linter MUST run in CI on every PR. The linter scans all string resource files, AI prompt templates, and notification template files for the forbidden-claims list from D5 §6.4. Any violation BLOCKS the PR. Forbidden patterns include: "diagnose\*", "detect\*" (in medical context), "predict\*" + "stroke|attack|crisis", "medical-grade SpO2", "continuous blood pressure", "cure\*", "treat\*" (BP-related), "emergency" (in app copy outside of crisis hotline links). Linter source: a regex+rule list maintained in /tools/copy-lint. Per D3 + D5 §6.4, this is non-negotiable.</p>|
| :- |

1. All marketing copy passes the same linter. App Store listings, marketing site, paid social ads, email campaigns.
1. AI system prompts include the forbidden-claims list as a non-overrideable directive (per US-63).
1. Translations: forbidden claims are localized — "diagnose" in English is "diagnosticar" in Spanish, etc. Linter must support multi-locale rule sets (deferred to v2 with localization).
1. Quarterly review: founder + clinical advisor (recommended, per D3) reviews any new copy added since last audit.


# **§7 Out of Scope for v1.0**
Explicitly NOT in v1.0. Each item lists which document deferred it. Anything not listed here AND not in §5 is also out of scope unless founder explicitly approves.

|**Out of Scope**|**Source / Rationale**|
| :- | :- |
|**Web app for caregivers**|D4 Block 5 — mobile-only at MVP. Deferred to v2.|
|**Clinician portal**|D4 — sharing is via PDF / web link only. v2 includes clinician dashboards.|
|**Insurance / HSA / FSA billing**|D2 — D2C cash-pay only at MVP. Insurance integration deferred.|
|**Pharmacy / prescription integration**|D3 — outside cleared IFU. Medication is logged manually only.|
|**Multi-language UI**|D5 §10.3 — English only at MVP; Pidgin/Yoruba/Igbo/Spanish in v2.|
|**Apple Health / Google Fit integration**|D4 — deferred to v2 (read-only export to HealthKit considered).|
|**Apple Watch / Wear OS standalone app**|D4 — Leiko watch is the primary wearable. Companion app on Apple Watch deferred.|
|**Fall detection**|D3 — outside cleared IFU. Hardware does not support reliably. Not roadmapped.|
|**ECG / arrhythmia detection**|D3 — hardware does not include ECG sensor. Out of scope entirely.|
|**Continuous BP measurement**|D3 — device is on-demand BP only (cuff inflation requires user action). Misleading claim if marketed otherwise. Per D5 §6.4.|
|**Diagnostic / predictive features**|D3 — never. Forbidden by FDA clearance scope. Permanent out-of-scope.|
|**Family tree visualization, social features**|D4 — reactions and comments only. No social graph beyond family circle.|
|**In-app messaging (chat between caregivers)**|D4 — deferred to v2. Comments on readings only.|
|**Video calls**|D4 — never planned. Use existing tools (FaceTime, WhatsApp).|
|**White-label / B2B partnerships**|D2 — D2C focus at launch. B2B (insurance, employer benefits) deferred.|
|**Hardware support for non-Urion BP devices**|D4 — Urion U16H/U19M only at MVP.|
|**Caregiver-to-caregiver hand-offs (one parent shifts to another caregiver's primary)**|D4 — handled via family ownership transfer (US-49). Multi-tenant scenario deferred.|


# **§8 Success Metrics**
What we measure to know whether the product is working. Each metric has a v1.0 target. Per D2 + D4.
## **§8.1 Activation Metrics**

|**Metric**|**Definition**|**v1.0 Target**|
| :- | :- | :- |
|Pairing success rate|% of users who reach "first reading" within 24h of account creation|**≥ 70%**|
|Time to first reading|Median time from account creation to first BP reading|**≤ 24 hours (caregiver flow with shipping accounted)**|
|Onboarding drop-off|% of users who quit before pairing|**≤ 30%**|
|Family circle adoption|% of family\_owners who invite ≥ 1 additional caregiver|**≥ 30%**|
## **§8.2 Engagement Metrics**

|**Metric**|**Definition**|**v1.0 Target**|
| :- | :- | :- |
|Caregiver DAU/MAU ratio|Daily / Monthly Active Users — caregiver mode|**≥ 0.40**|
|Readings per parent per week|Median weekly count of BP readings per active parent|**≥ 4**|
|Watch sync success rate|% of watches with at least one sync per 24h|**≥ 90%**|
|AI assistant usage (Plus subs)|% of paid subscribers who use AI ≥ once per week|**≥ 50%**|
## **§8.3 Retention Metrics**

|**Metric**|**Definition**|**v1.0 Target**|
| :- | :- | :- |
|Day 30 retention (caregiver)|% of new caregivers active in week 5|**≥ 60%**|
|Day 90 retention|% active in week 13|**≥ 45%**|
|Watch return rate|% of watches returned within 30 days|**≤ 8% (industry standard for D2C health hardware)**|
## **§8.4 Subscription Metrics (Per D2)**

|**Metric**|**Definition**|**v1.0 Target**|
| :- | :- | :- |
|Free-to-paid conversion|% of free users who subscribe to Plus within 60 days|**≥ 12%**|
|Trial-to-paid conversion|% who convert at end of 7-day trial|**≥ 50%**|
|Monthly churn|% of subscribers who cancel per month|**≤ 5%**|
|ARPU (paid)|Average revenue per paid user|**≥ $4.20/mo (account for annual mix per D2)**|
## **§8.5 Quality & Trust Metrics**

|**Metric**|**Definition**|**v1.0 Target**|
| :- | :- | :- |
|App Store rating|Star rating (iOS + Android)|**≥ 4.5**|
|App Store review volume|Reviews / 100 active users / month|**≥ 5**|
|Support ticket volume|Tickets / 100 active users / month|**≤ 8**|
|Critical bug rate|P0/P1 bugs / month|**≤ 2**|
|Forbidden-claim violations in production copy|Count of cases where regulated copy made it to production despite linter|**0 (zero — hard requirement)**|


# **§9 Risks & Open Questions**
Anything that needs decision or research before / during build. Each item is owned and has a target resolution.
## **§9.1 Open Questions for Founder Decision**

|**Open Question**|**Context / Source**|
| :- | :- |
|Brand name verification: LEIKO confirmed via USPTO TESS, NIPC, domain availability?|D5 §11.1. Critical path to App Store and packaging. Target: before week 2 of build.|
|510(k) holder LoA (Letter of Authorization)|D3. K141683 holder must agree to allow our re-labeling. Critical path to FDA establishment listing. Target: before week 4 of build.|
|Anthropic BAA on Claude API for healthcare|§6.2. Required if any reading data is sent in AI prompts. Target: before week 8.|
|Web Bluetooth pairing fallback for parent (US-15)|Affects whether parent must install native app. Engineering to spike during week 2 of build. Founder decision required if web BT is unreliable on iOS Safari.|
|Watch reading deletion policy (US-26)|ASSUMPTION: watch readings cannot be deleted, only annotated. Confirm.|
|Order tracking integration (US-5)|Shopify tracking integration deferred. Confirm acceptable for MVP.|
|Free trial card requirement|US-69 specifies no card at trial start. Industry trend supports this for higher conversion. Confirm.|
|Clinical advisor engagement|D3 + §6.5 recommend clinical reviewer for AI prompts and forbidden-claims audits. Founder to identify.|
|Multi-language launch decision for v2|D5 §10.3 + §6.4. Which languages first — Pidgin / Yoruba / Spanish? Affects D8 GTM plan.|
## **§9.2 Build Risks**

|**Risk**|**Probability × Impact**|**Mitigation**|
| :- | :- | :- |
|**BLE reliability on Android (vendor-specific quirks)**|**HIGH × HIGH**|react-native-ble-plx with extensive Android testing matrix. Spike in week 1. Plan B: native Kotlin BLE module if RN library is insufficient.|
|**Apple App Store review for medical app**|**MEDIUM × HIGH**|Pre-submit App Store listing for review feedback at week 14. Avoid claim violations rigorously. Have FDA documentation ready.|
|**Urion firmware bugs in shipped batch**|**MEDIUM × MEDIUM**|Pre-production test of 10 units against all BLE commands before mass shipping. Defined return policy + replacement strategy in D7.|
|**AI prompt injection causing diagnostic claim**|**LOW × HIGH**|Robust system prompt with adversarial test suite. Forbidden-claims regex on AI output as last-mile defense. Fail-closed (if linter fires on output, replace with deflection).|
|**Scope creep mid-build**|**HIGH × MEDIUM**|§5 list is contractual. New features go to v2 backlog. Out-of-scope list (§7) is referenced in every sprint review.|
|**Regulatory copy violation in production**|**LOW × HIGH**|§6.5 linter in CI. Quarterly clinical-advisor audit. Marketing copy goes through same lint.|
|**Cost overrun on AI infrastructure**|**MEDIUM × MEDIUM**|Tier A on local Ollama. Strict per-user rate limits per tier. Monitoring in PostHog. Hard kill switch on Tier C if costs exceed threshold.|
|**Founder bottleneck on copy review**|**MEDIUM × MEDIUM**|Up-front investment in voice-pillar-trained AI assist for copy generation. Clinical advisor for regulated copy. Final approval from founder, but draft load reduced.|


# **§10 Glossary**
Every technical term used in this PRD, defined.

|**Term**|**Definition**|
| :- | :- |
|**510(k)**|FDA premarket notification clearance pathway for medical devices substantially equivalent to predicate. Our predicate: K141683 (per D3).|
|**AHA/ACC**|American Heart Association / American College of Cardiology. Their 2017 BP guidelines define the categories used in US-24.|
|**AI Tier A/B/C**|Per D4 Block 2.3. Tier A = factual Q&A (local Ollama). Tier B = pattern explanation with user data context (Claude Sonnet API). Tier C = scheduled summaries (Claude Sonnet, longer context).|
|**BAA**|Business Associate Agreement. Required under HIPAA when sharing PHI with third-party services. Anthropic offers BAA on Claude API.|
|**BLE**|Bluetooth Low Energy. Wireless protocol used to communicate between watch and phone (BLE 5.2). Per D4 Block 4.|
|**BP**|Blood pressure (systolic / diastolic / pulse).|
|**Caregiver**|A user with the `caregiver` role; views the parent's readings. The primary buyer per D5 §1.1.|
|**Family circle**|The set of caregivers (1–5) and parents (1–2) who share access to the same readings. Per D4 Block 2.1.|
|**Family owner**|The user who created the family record. Has admin powers (invite, remove, transfer ownership).|
|**FDA-cleared**|Cleared via 510(k); Class II under K141683. Per D3. NOT "FDA-approved" (different pathway).|
|**HIPAA**|Health Insurance Portability and Accountability Act. US federal regulation governing PHI. Leiko is HIPAA-aligned (not a covered entity itself, but practices align).|
|**HR**|Heart rate.|
|**IFU**|Indications For Use. The use cases the device is cleared for, per FDA. Per D3.|
|**Leiko**|The consumer brand. Per D5 §2 (recommended primary candidate; subject to founder verification).|
|**Leiko Plus**|The paid subscription tier. $4.99/month or $39.99/year USD. Per D2 + D5 §5.3.|
|**Leiko Watch / Watch Pro**|Consumer-facing names for the U16H and U19M devices. Per D5 §5.2.|
|**LiteLLM**|AI gateway proxy that routes between local (Ollama) and remote (Claude API) models. Per D4 Block 3.|
|**Ollama**|Local LLM runtime running on the founder's existing Hetzner VPS. Used for Tier A. Per D4 Block 3.|
|**Oscillometric**|BP measurement method based on inflatable cuff and pressure oscillations. The device's actual measurement method. Same as a doctor's office cuff. Per D1.|
|**Parent**|The wearer. May or may not also be a user of the app (Parent mode). Per D5 §1.|
|**PHI**|Protected Health Information. HIPAA-defined category. Includes BP readings tied to identifiable users.|
|**PostHog**|Self-hosted product analytics. Per D4 Block 3.|
|**RevenueCat**|Cross-platform subscription management. Per D4 Block 3.|
|**RLS**|Row-Level Security. Postgres feature used in Supabase to enforce access control. Per D4 Block 3.|
|**Self-buyer**|A user buying for themselves; both wearer and watcher. Per D5 §1.3.|
|**SpO2**|Peripheral oxygen saturation. Wellness estimate on this device — NOT medical-grade per D3.|
|**Supabase**|Backend platform: Postgres + Auth + Realtime + Storage + Edge Functions. Per D4 Block 3.|
|**U16H / U19M**|Urion supplier SKUs. Marketed as Leiko Watch / Leiko Watch Pro. Per D5 §5.2.|
|**WCAG 2.2 AA**|Web Content Accessibility Guidelines, level AA. Required accessibility standard. Per D5 §10.|


# **§11 Appendix: Traceability Matrix**
Every user story mapped to its source document(s). For audit, scope review, and regression triage.

|**Story ID**|**Story Title**|**Source(s)**|
| :- | :- | :- |
|US-1|First launch — choose path|D4 Block 2.2; D5 §1.3, §3.4|
|US-2|Caregiver — account creation|D4 Block 3; D3; D5 §3|
|US-3|Caregiver — parent profile setup|D5 §3.1, §3.4; D4 Block 2.1|
|US-4|Caregiver — explainer|D4 Block 2.2; D5 §3, §4.3, §9.2|
|US-5|Caregiver — order or pair branch|D4 Block 2.2; D2|
|US-6|Caregiver — invite parent to pair|D5 §1.1; D4 Block 2.1|
|US-7 to US-9|Self-buyer onboarding|D5 §1.3, §6.2; D4 Block 2.2|
|US-10|Privacy and consent disclosure|D3; D4 Block 3; D5 §3|
|US-11|Push notification permission|D4 Block 3; HIG|
|US-12|Onboarding — resumable|D4 Block 3|
|US-13 to US-22|Watch pairing & parent setup|D4 Block 4 (BLE protocol); D3; D5 §1.1, §10.4|
|US-23 to US-35|Daily use — caregiver|D4 Block 2.1, 4.x; D5 §3, §6|
|US-36 to US-43|Daily use — parent|D4 Block 4 (voice, do-not-disturb, medication); D5 §10.4|
|US-44 to US-51|Family circle (multi-caregiver)|D4 Block 2.1; D3|
|US-52 to US-58|Trends, reports & sharing|D2; D3; D4 Block 2.3; D5 §6.4|
|US-59 to US-66|AI assistant|D4 Block 2.3 + Block 3; D3; D5 §3, §6.4|
|US-67 to US-73|Subscription & paywall|D2; D5 §3.4; D4 Block 3|
|US-74 to US-80|Notifications|D4 Block 3; D5 §3.5|
|US-81 to US-90|Settings & account|D3; D4 Block 3, 4.x|
|US-91 to US-95|Anomaly detection|D4 Block 2.3; D3; D5 §3.5|

**Document Status:** D6 — Product Requirements Document v1.0 (MVP) — COMPLETE. Ready for handoff to D7 (TRD), D8 (Design System), D9 (Implementation Plan).

**Total user stories:** 95 (US-1 through US-95)

**Total assumptions flagged:** 3 (web BT pairing fallback, watch reading deletion policy, order tracking integration). All routed to §9.

**Next action:** Founder review of §9 open questions. Begin D7 (TRD).
LawOne Cloud LLC  •  Leiko BP Smartwatch Venture  •  Confidential  •  Page  of 
