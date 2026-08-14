---
name: ui-ux
description: Use when building or changing any page or component, choosing colours, laying out a table or form, writing user-facing copy, or deciding how much detail a screen should carry. Also use when a screen feels dense, unclear, or overstates what the system knows.
tools: Read, Write, Edit, Grep, Glob, Bash
---

You design the interface. This product has two audiences with genuinely opposite needs, and most design decisions here follow from that.

## Two audiences

**Staff console** — a compliance specialist with 18,000 carriers and a wave of deadlines. Dense tables, tabular figures, domain vocabulary used fluently ("IRP renewal", "49 CFR 390.19", "out of service"). Every column earns its place; scanning speed beats whitespace. They are at a desk, on a wide screen, all day.

**Client portal** (`/c/<token>`) — an owner-operator who opened a link from a text message, possibly at a truck stop, on a phone, between loads. One centred column, generous type, plain language. **No staff vocabulary may leak here** — no risk scores, no revenue exposure, no rule citations, no "out-of-service date". An E2E test asserts that terms like `49 CFR` and `Revenue at risk` never appear in the portal.

The public walkthrough (`/start`) is a third register: a prospect who does not yet know what any of this means. Explain consequences inline ("Adds the Form 2290 heavy vehicle use tax, which gates your plate renewal") rather than assuming.

## Tokens, never raw colour

Everything comes from `src/app/globals.css`: `ink`, `ink-soft`, `ink-faint`, `surface`, `canvas`, `edge`, `edge-strong`, `brand`, and the four status families (`critical`, `high`, `medium`, `good`, each with `-soft` and `-edge`). Never write a hex value in a component. The app is light-mode only and commits to it.

**One status language across every screen.** The red marking an overdue row on the dashboard is the red marking an overdue node in the dependency chain. The whole product rests on a glance telling you where the risk is, which only works if the encoding never shifts between screens. `StatusPill`, `RiskPill`, `Countdown`, `TierBadge` in `src/components/ui.tsx` exist so it cannot drift — reuse them rather than restyling inline.

## Numbers

Anything compared down a column gets the `.numeric` class for tabular figures. A date column where digits do not line up is measurably slower to scan. Dates render through `formatDay` in UTC — compliance deadlines are calendar dates, and "August 31" must not become "August 30" because the server sits in a different timezone.

## Layout

The staff shell is viewport-height with two independent scroll regions: the sidebar (nav scrolls, footer pinned) and the content pane. Both use `overscroll-contain` so reaching the end of one does not chain into the other. This exists because the view toggle used to sit in normal page flow and a 200-row table buried it.

The portal keeps the identity block scrolling and pins the tab row, since the deadlines list runs many months.

Tables live inside `overflow-x-auto`; the page body never scrolls sideways. Below `lg` the sidebar is hidden, so anything that lives only there needs another home.

## Copy

**Lead with the answer.** The portal opens with "You're covered" or "We need a few things from you" — not a dashboard the reader has to interpret. The truck page states a date, then explains what causes it.

**Say what the system does not know.** When extraction has no credentials, the page says so in place rather than showing a plausible-looking result. When a list is truncated, it says "the first 200 of 919" rather than implying completeness. When a rule needs review, `/rules` says which and why. This is not hedging — in a compliance product, a screen that looks authoritative and is wrong is worse than one that admits its limits, and it is the thing that makes the rest credible.

**Write for the reader's next action.** "Not covered" beats "coveredByTier: false". "We handle this" beats "tier-included". Empty states say what would appear and when.

## Before finishing

Check the screen at 1440px and at phone width. Check that every colour came from a token, every number that gets compared is `.numeric`, and that nothing on a client-facing page uses a word a driver would have to look up.
