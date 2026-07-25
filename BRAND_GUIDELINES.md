# Interactive League — Visual Brand Guidelines

Reference: Football Manager 2024 UI (dark, greyscale, single accent colour, data-driven detail).
Goal: a calm, "pro sim" greyscale interface where colour is reserved for **meaning** (status,
performance, alerts) — never decoration. One accent colour for interactive/primary elements.

---

## 1. Colour System

All colours are greyscale except the **accent** (indigo/violet) and the small set of
**status colours** used only to encode data (form, condition, morale, finance deltas).

### Greyscale (surfaces & text)
| Token | Value | Usage |
|---|---|---|
| `--background` | `#0a0b0d` | App background (near-black, slight blue tint) |
| `--surface` / `--card` | `#16171b` | Panels, cards, table containers |
| `--surface-2` / `--popover` | `#1c1e23` | Raised surfaces: dropdowns, modals, headers within panels |
| `--surface-3` / `--muted` | `#222429` | Inputs, hover states, nested rows |
| `--border` | `#2a2c33` | Hairline borders / dividers |
| `--border-strong` | `#34373f` | Emphasized borders, focus outlines |
| `--foreground` | `#f4f4f5` | Primary text |
| `--muted-foreground` | `#8b8d96` | Secondary text, labels, captions |
| `--faint-foreground` | `#5a5d66` | Disabled / placeholder text |

### Accent (single hue — indigo/violet)
| Token | Value | Usage |
|---|---|---|
| `--accent` | `#6366f1` | Primary buttons, active nav item, active tab underline, links, focus rings |
| `--accent-hover` | `#7c7ff4` | Hover state for accent elements |
| `--accent-muted` | `#6366f1` at 12-15% opacity | Active-state backgrounds (sidebar item, selected tab bg) |
| `--accent-foreground` | `#ffffff` | Text/icons on accent fill |

Accent is used **sparingly**: one primary CTA per view, the active sidebar item, active tab
indicator, focus rings, and links. It should never be used for large background fills.

### Status colours (data only — never UI chrome)
| Token | Value | Meaning |
|---|---|---|
| `--status-positive` | `#34d399` (emerald-400) | Good form, positive finance, healthy condition |
| `--status-warning` | `#fbbf24` (amber-400) | Average / caution / pending |
| `--status-negative` | `#f87171` (red-400) | Bad form, negative finance, injury/suspension |
| `--status-neutral` | `#71717a` | No data / inactive |
| `--gold` | `#facc15` | Star ratings, trophies, prize highlights |

**Rule of thumb**: if you're tempted to add a new colour, ask "is this encoding data, or
decorating UI?" Decoration stays greyscale + accent. Only data gets status colour.

---

## 2. Typography

- Font: Geist Sans (already in project) — clean, geometric, works well at small sizes.
- Headings: bold, tight tracking (`tracking-tight`), sentence case for page titles
  (e.g. "Tactics", "Your Leagues").
- Eyebrow / overline labels: `text-[10px] uppercase tracking-[0.25em] text-muted-foreground`
  — used above page titles and section headers (FM-style "OVERVIEW", "INSTRUCTIONS").
- Table/column headers: `text-[11px] uppercase tracking-wider text-muted-foreground font-medium`.
- Body: `text-sm` default, `text-base` for primary content.
- Numbers (money, ratings, stats): tabular figures (`font-variant-numeric: tabular-nums`) so
  columns align.

---

## 3. Surfaces & Layout

- **Page background**: `--background`, flat, no gradients, no colour washes.
- **Panels/cards**: `--surface` with `1px solid var(--border)`, `rounded-lg` (8px), no heavy
  shadows — depth comes from subtle border + slightly lighter surface tone, not shadow.
- **Section headers within panels**: `--surface-2` background, small icon + uppercase label,
  bottom border.
- **Tables**: zebra-free, hairline row dividers (`border-border/60`), hover row highlight
  `bg-surface-3/60` with smooth transition. Left-edge 2-3px colour bar to group rows by
  category (role, status) — colour bars use status colours or muted greys, not accent.
- **Sidebar**: kept (per request), restyle to match — `--background`/`--surface` tone,
  active item gets `--accent-muted` background + `--accent` left bar + accent icon/text.

---

## 4. Components

- **Buttons**
  - Primary: solid `--accent` fill, white text, `rounded-md`, subtle hover lighten +
    `transition-colors duration-150`.
  - Secondary/outline: transparent, `1px solid var(--border)`, hover `bg-surface-3`.
  - Destructive: reserved, greyscale by default, only goes red on hover/confirm for
    delete-type actions.
- **Tabs**: text-only, muted by default, active = `--foreground` + 2px `--accent` underline,
  animate underline position with `transition-all duration-200`.
- **Badges/pills**: greyscale by default (`--surface-3` bg, `--muted-foreground` text);
  status pills use status colours at ~15% bg opacity + full-opacity text.
- **Progress/sparkline bars**: thin (1.5–2px), greyscale track, status-colour fill.
- **Star ratings**: `--gold` filled stars, `--border-strong` empty stars.
- **Avatars/crests**: circular, `1px solid var(--border)`, fallback = initials on
  `--surface-3`.

---

## 5. Micro-animations

Keep subtle, fast (120–200ms), `ease-out`. Examples:
- Buttons: `transition-colors duration-150` on hover/active.
- Cards/rows: `transition-colors duration-150` on hover background.
- Tab underline: `transition-all duration-200` sliding indicator.
- Page/section entrance: fade + translate-y-1 (`animate-in fade-in slide-in-from-bottom-1
  duration-300`) via `tw-animate-css` (already installed).
- Collapsible sections / dropdowns: height/opacity transitions (Radix defaults).
- Numbers updating (balance, rank): brief colour flash (accent or status colour) fading back
  to base over 400ms.
- Avoid: bounces, scale-pop, spinning icons except real loading spinners.

---

## 6. Iconography

- `lucide-react` (already in use), `size-4` default, `size-3.5` in dense tables.
- Icons follow text colour (`currentColor`) — never independently coloured unless encoding
  status (e.g. condition heart icon green/amber/red).

---

## 7. Implementation Notes

- All tokens above are defined as CSS variables in `app/globals.css` under `.dark` (the app
  is dark-only, `forcedTheme="dark"`).
- Status colours get their own custom properties (`--status-positive` etc.) and matching
  Tailwind utility classes via `@theme inline` so they can be used as
  `text-status-positive`, `bg-status-warning/15`, etc.
- Roll-out order: design tokens → sidebar/layout shell → high-traffic pages (saves,
  dashboard, squad, tactics, standings) → remaining pages.
