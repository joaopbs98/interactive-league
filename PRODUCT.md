# Product

## Register

product

## Users

Groups of friends running a private, multi-season fantasy football club-management league
together. Each user owns a club within a shared league: they manage their squad, tactics,
contracts, finances, and transfers, and compete against the other clubs in the league across
simulated seasons. One user per league typically also acts as **host**, with extra admin
controls (schedule generation, season lifecycle, match simulation mode, transfer windows).

Primary workflows: checking squad/league status at a glance (dashboard hub), setting tactics
before matches, managing the transfer market (free agents, trades, auctions, draft, packs),
tracking finances/contracts/sponsors, and (for hosts) running the league lifecycle.

## Product Purpose

Interactive League is a deep, ongoing club-management sim played with friends — closer to a
shared Football Manager save than a casual mobile game. It exists to give a private league of
friends a persistent "front office" for their clubs: real squads, ratings, contracts, and
finances that evolve season over season through simulated matches and player-driven
transactions (trades, packs, free agency, drafts).

Success looks like: a host can run a full season lifecycle without confusion, and any team
manager can open the dashboard and immediately understand "where do I stand, what needs my
attention, and what should I do next."

## Brand Personality

Sleek, premium, and data-dense/analytical — a calm "pro sim" tool, not a game show. Confident
and understated: depth comes from information clarity (tables, charts, tabular numbers), not
decoration. Reference: Football Manager 2024's dark UI — greyscale base, single accent colour,
colour reserved for meaning (form, finance deltas, injuries, ratings).

## Anti-references

- Colorful, playful mobile-game UI: bright multi-colour gradients, cartoonish badges,
  candy-like buttons, "ice cream truck" palettes.
- Generic AI-generated SaaS look: purple/blue gradient washes, glassmorphism, blob shapes,
  overused gradient buttons. The current indigo accent (#6366f1) is intentional and should
  stay flat/solid — never used as a gradient background.
- Cluttered, unstyled spreadsheet tables with no visual hierarchy.

## Design Principles

1. **Colour encodes meaning, never decoration** — status colours (positive/warning/negative/
   gold) are reserved for data (form, finances, injuries, ratings, standings). Everything
   else is greyscale + the single indigo accent.
2. **One accent, used sparingly** — indigo (#6366f1) marks primary actions, active nav/tabs,
   links, and focus states only. Never a large fill or gradient.
3. **Data density with clarity** — this is an analytical tool for engaged users; favor
   compact tables, charts, and tabular-aligned numbers over whitespace-heavy marketing
   layouts, but keep hierarchy scannable (uppercase tracked labels, consistent spacing).
4. **Calm, subtle motion** — micro-animations (120–200ms, ease-out) for hover/active/entrance
   states only. No bounces, scale-pops, or attention-grabbing motion.
5. **Game-state first** — every screen should make the club's current situation and the
   user's next action obvious (next match, pending trades, contracts ending, transfer window
   status, league position).

## Accessibility & Inclusion

- Dark-only theme (`forcedTheme="dark"`); body text and labels must meet WCAG AA contrast
  against the greyscale surface tokens.
- Status colours (form, injuries, finance deltas) must never be the *only* signal — pair with
  text, icons, or position (e.g. "W"/"L"/"D" letters, not just coloured dots) so the app
  remains usable for colour-blind users.
- Interactive elements (buttons, tabs, table rows) need visible focus states using the accent
  ring, for keyboard navigation.
