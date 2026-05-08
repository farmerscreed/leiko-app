# Design Bundles

External design exports from claude.ai/design that are the source of truth for
multi-screen visual work. The HTML/CSS/JS files are prototypes — production
code translates them to React Native, matching visual output, not internal
structure (per the bundle README).

---

## Bundle 01 — Self-buyer + caregiver homes (Sprint 7.7 / 8 / 8.5)

**URL:** https://api.anthropic.com/v1/design/h/HQoI9Ap2h9saGXEiMgMpFA?open_file=leiko-home.html

The link returns a gzipped tar archive. Decompress to see `new-design/`
containing `README.md`, `chats/chat1.md`, and a `project/` directory with
HTML + JSX prototypes.

| File | Covers | Sprint |
|---|---|---|
| `leiko-home.html` + `leiko-home.jsx` + `leiko-constellation.jsx` + `leiko-icons.jsx` + `ios-frame.jsx` + `leiko-app.jsx` + `tweaks-panel.jsx` | Self-buyer Daily Pulse home (constellation hero + AI narration + vital tile strip + correlation strip + Recents history list + FAB + tab bar) | 8 |
| `leiko-home-v2.html` | Editorial alternate home — the **Day Spine** ("Through your day") section is the canonical source for Sprint 8's Recents-replacement | 8 |
| `Leiko Self-Buyer Home.html` + `selfbuyer-shell.jsx` + `selfbuyer-screens.jsx` + `design-canvas.jsx` | Three home variants (A · Today thread, B · Stack, C · Felt Body) plus Trends, Family, You — exploratory canvas; not selected for Sprint 8 | reference |
| `leiko-detail.jsx` + `leiko-detail-screens.jsx` + `leiko-home-print.html` | Per-vital detail screens (BP / HR / SpO2 / Sleep / Activity) | 8.5 |
| `leiko-caregiver-unified.html` + `leiko-caregiver-a.jsx` + `leiko-caregiver-b.jsx` + `leiko-caregiver-c.jsx` + `leiko-caregiver-detail.jsx` + `leiko-caregiver-people.jsx` + `leiko-caregiver.html` | Caregiver home unified (bird's-eye ↔ detailed toggle + drill-in) | 7.7 (shipped) |
| `chats/chat1.md` | Conversation transcript that established intent across all the above | reference |

### Sprint 8 specifics

Founder's call (2026-05-08): use **`leiko-home.html`** as the base for the
self-buyer Home screen, **swap the 4th section "Recents" for "Through the Day"
from `leiko-home-v2.html`**. See `docs/04-screens/self-buyer-home.md` for the
implementation spec.

### How to refresh

Bundles are exported by the user from claude.ai/design. To refresh:

1. Re-export from the design tool. The URL stays stable per session — paste
   the new URL here when it changes.
2. The bundle is a gzipped tar. Decompress with `gunzip` then `tar -xf` to
   get readable `.html` / `.jsx` files.
3. Read `README.md` first, then `chats/*.md` for intent, then the HTML files
   the chat references.
