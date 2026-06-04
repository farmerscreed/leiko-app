# Beta-landing funnel — leiko.app → Google Play closed test

**Job:** turn a `leiko.app` visitor into an opted-in Play closed tester, and
hit the individual-account bar of **12 testers opted-in for 14 days**.

Voice-checked against `docs/05-voice-and-claims.md`: no "patient", no
medical-claim verbs, no fear language, lead with the answer, warm + plain.

---

## The mechanics (how Play closed testing actually works)

A closed test is **opt-in only** — there's no public install. A visitor
must (1) be on the tester list (a **Google Group** is easiest), then (2)
**opt in** via Play's web URL, then (3) install from the Play listing
(visible only to opted-in testers).

So the page is a **3-step funnel**, not one button:

```
[1] Join the testers   → join the Google Group (leiko-testers@googlegroups.com)
        ↓
[2] Become a tester    → https://play.google.com/apps/testing/com.leiko.app
        ↓
[3] Get it on Google Play → https://play.google.com/store/apps/details?id=com.leiko.app
```

Tell people to use the **same Google account** on all three steps, on the
**Android phone** they'll test with — that's the #1 support issue ("I can't
find it on Play" = not opted in, or wrong account).

---

## Page copy (drop-in, voice-checked)

**Eyebrow:** Early access

**Headline:** See blood pressure clearly — for you, or someone you love.

**Sub:** Leiko pairs with your watch and turns the numbers into something
calm and readable, and keeps families close even when they're far apart.
We're opening a small early test on Android. Come in.

**Step 1 — card "Join the testers"**
Body: *First, join our tester group with the Google account on your Android
phone. It tells Google Play you're on the list.*
Button: **Join the tester group** → Google Group URL

**Step 2 — card "Turn on the test"**
Body: *Tap below, then "Become a tester." Use the same Google account.*
Button: **Become a tester** → opt-in URL

**Step 3 — card "Install Leiko"**
Body: *Now Leiko is yours to install from Google Play.*
Button: **Get it on Google Play** → Play listing URL

**Reassurance line (footer):** It's an early test, so a few rough edges are
normal — tell us what you find and we'll fix it. Your readings stay private
and encrypted.

**Help line:** Can't see it on Play? You're probably signed into a different
Google account, or step 2 didn't finish. Redo steps 1–2 on your phone.

---

## What to avoid (voice + policy)

- ❌ "Detect / prevent / predict hypertension", "catch the silent killer",
  "medical-grade diagnosis" — all forbidden and also Play health-claim risk.
- ❌ Promising outcomes ("lower your BP", "live longer").
- ✅ Describe what it *does* (reads, shows, shares, keeps families close).
- ✅ "Talk to your doctor" framing, never "medical advice".

---

## Tracking (optional, no PHI)

If you measure the funnel, count **events only** (join_clicked,
optin_clicked, install_clicked) — never reading values or personal data,
per the analytics rule in CLAUDE.md / D7 §7.

---

## URLs to fill once Play is set up

| Placeholder | Where it comes from |
| --- | --- |
| Google Group URL | the group you create (`…@googlegroups.com`) |
| Opt-in URL | `https://play.google.com/apps/testing/com.leiko.app` |
| Play listing URL | `https://play.google.com/store/apps/details?id=com.leiko.app` |
