# Interactive League ’25 (IL25) — Full Project Spec (for Cursor)
> **Purpose:** Paste this into Cursor as the **single source of truth** for implementing IL25 end-to-end (UI screens + backend/game logic + integrity).  
> It includes a **Gap Audit** section to compare against your current Cursor project and find missing/broken screens/logic.

---

## Table of Contents
1. Product Summary
2. Game Loop & State Machine
3. Core Rules (Roster, Budget, Wage Cap, Windows)
4. Data Model (Entities + Relationships)
5. Screen Map (All UI Screens + Required Behaviors)
6. Server-Side Functions (Edge/RPC) — Full List + Requirements
7. Match Simulation (Results, Standings, Stats)
8. Offseason Systems (Draft, Auctions/FA, Trades, Packs)
9. Finances (Ledger, Wages, Loans, Sponsors, Prize Money)
10. Conditional Clauses (Trade Objectives)
11. Injuries & Suspensions
12. Real-time + Notifications + Audit Logging
13. Security & Anti-Cheat (Authorization + Atomicity)
14. Gap Audit Checklist (Repo comparison)
15. Implementation Notes (Idempotency, Seeds, Testing)

---

# 1) Product Summary

**Interactive League ’25 (IL25)** is a multiplayer football manager simulation with:
- **Season-based progression** (no mid-season roster changes)
- **Roster changes only in OFFSEASON**: Draft, Auctions/Free Agency, Trades, Packs (recommended: OFFSEASON only)
- **Host/Commissioner** manually advances matchdays and triggers end-season
- **Finances**: budgets, wages, loans, sponsorships, prize money, fines
- **Auditability**: logs for RNG outcomes, match simulations, end-season processing, and manual admin actions

**Golden rule:** anything that can be exploited (money, RNG, player assignment, standings) must be **server-side** and **atomic**.

---

# 2) Game Loop & State Machine

## 2.1 League Status (recommended enum)
- `PRESEASON_SETUP` — league created, invites, teams join, initial squads created
- `IN_SEASON` — matchdays simulated; rosters locked
- `OFFSEASON` — draft/auctions/trades/packs
- `SEASON_END_PROCESSING` — endSeason running
- `ARCHIVED` — optional

## 2.2 Season Cycle
1) Create league + invite members  
2) Each manager gets a **team + initial squad** (18 players, balanced positions) + **initial budget** (e.g. €250M)  
3) Generate fixtures (schedule)  
4) `IN_SEASON` (host manually triggers matchdays)  
5) At end of last round: run `endSeason` (atomic)  
6) Switch to `OFFSEASON` (draft/auctions/trades/packs)  
7) Start next season → back to `IN_SEASON`

**Critical constraint:** No roster moves during `IN_SEASON`.

---

# 3) Core Rules

## 3.1 Roster size
- **Initial roster:** ~18 players (balanced by position)
- **Max roster:** **25** players under contract
- Enforce this rule in: Draft, Auctions/FA, Trades, Pack openings, any “assign player to team”.

### Required enforcement behaviors
- If action would exceed 25: **block** OR enforce a discard/waiver flow (choose one and implement consistently).
- For packs (usually 3 players): simplest = prevent opening if roster > 22.

## 3.2 Wage feasibility (“wage cap”)
Minimum baseline:
- A team must not be allowed to take on wage commitments that are not feasible.
- Practical rule: block if **total annual salaries** would exceed **available budget** (or exceed a defined wage cap formula if you later add one).

## 3.3 Windows / phase locks
- `IN_SEASON`: no trades, no free agent signings, no auctions, no draft, no packs (recommended), no player edits beyond lineup/tactics.
- `OFFSEASON`: roster movement is enabled.

**This must be enforced server-side** (not just hidden in UI).

---

# 4) Data Model (entities + relationships)

> Adjust naming to your schema. What matters is the behavior and constraints.

## 4.1 League
- `id`, `name`, `host_user_id`
- `invite_code`
- `current_season`, `current_round`
- `status`
- `created_at`

## 4.2 Team
- `id`, `league_id`, `user_id`
- `name`
- `budget`
- `comp_index` (or computed)
- `stock_value` (or computed)
- `sponsor_id`
- `created_at`

## 4.3 Player
- `id`, `league_id`
- `name`, `position`, `ovr`
- `team_id` nullable (NULL = free agent / draft pool)
- `injury_games_remaining`
- `suspension_games_remaining` (optional)
- `stats` (goals, assists, etc.)
- `created_at`

## 4.4 Contract
- `id`, `player_id`, `team_id`
- `salary_year`
- `years_remaining`
- `signing_bonus` (0 if none)
- `guaranteed` boolean
- `status` (active/expired/terminated)
- `created_at`

**Season end behavior**
- `years_remaining -= 1` for active contracts
- if `years_remaining == 0`: contract expires; player becomes free agent (`team_id=NULL`)

## 4.5 Fixture/Match
- `id`, `league_id`, `season`, `round`
- `home_team_id`, `away_team_id`
- `home_goals`, `away_goals`
- `status` (scheduled/simulated)
- `played_at`

## 4.6 Standings (materialized table or view)
- `league_id`, `season`, `team_id`
- `played`, `wins`, `draws`, `losses`
- `goals_for`, `goals_against`, `goal_diff`, `points`

## 4.7 Finance Ledger (mandatory)
- `id`, `league_id`, `team_id`, `season`
- `type` (pack_purchase, signing_bonus, wage_payment, prize_money, sponsor_bonus, fine, trade_payment, loan_draw, loan_payment, etc.)
- `amount` (positive=in, negative=out)
- `description`
- `ref_type`, `ref_id` (optional)
- `created_at`

**Rule:** every budget change must generate a ledger row (no silent mutations).

## 4.8 Sponsorship
- `id`, `name`
- `base_payment`
- `bonus_rules` JSON (objectives → bonus)
- `penalty_rules` JSON (optional)

## 4.9 Trades
- `trades`: `id`, `league_id`, `season`, `status` (proposed/accepted/rejected/executed)
- `trade_items`: each side can include players, money, picks, objectives
- `trade_objectives`: conditional clauses evaluated at season end

## 4.10 Draft
- `draft_picks`: pick ownership (`original_team_id`, `current_owner_team_id`)
- `draft_selections`: records which player/item got selected

**Draft order rule:** inverse of prior season standings (season 2+).

## 4.11 Auctions / Free Agency
- `free_agent_bids`: bid payload (bonus + salary + years)
- (optional) auction windows table

## 4.12 Packs
- `packs`: price and rating rules
- `pack_openings`: store results + `rng_seed` for audit transparency

## 4.13 Audit Logs (mandatory)
- `audit_logs`: action name, actor, payload JSON, created_at

Log at least:
- matchday simulation summary
- pack opening seed + results
- endSeason summary counts + money moved
- fines applied
- trades executed

---

# 5) Screen Map (ALL UI screens you should have)

## 5.1 Auth / Onboarding
1. Login / Signup
2. Create League / Join League (invite code / invite link)
3. League Lobby (teams list, host sees controls)
4. Profile (name, avatar upload, email change w/ confirmation)

## 5.2 Core gameplay
1. Dashboard (season/round, status, money, alerts)
2. Schedule (fixtures/results by round)
3. Standings
4. Squad / Team (roster, positions, OVR, contract + salary)
5. Tactics / Lineup (select XI; injured/suspended cannot be selected)
6. Contracts (view, expiry, termination rules if supported)
7. Transactions / Finances (ledger viewer, filters)
8. Loans (if supported)
9. Sponsorships (objectives + bonuses)
10. CompIndex (comp index + stock value)
11. Injuries & Suspensions

## 5.3 Offseason-only screens
1. Draft
2. Free Agents / Auctions
3. Trades
4. Packs

## 5.4 Host/Admin-only screens
1. Host Control Panel:
   - Simulate matchday (advance round)
   - Apply fine
   - Generate injuries (manual randomizer)
   - Approve trades (optional rule)
   - End season
2. Audit Logs Viewer

---

# 6) Server-side functions (Edge/RPC) — REQUIRED LIST

**All of these must enforce:**
- Authorization (manager vs host)
- League membership
- League phase locks
- Atomic transactions
- Roster cap
- Finance ledger writes
- Audit log writes (for sensitive ones)
- Idempotency protection where needed

## 6.1 League setup
### `createLeague(name)`
- Create league, assign host_user_id, generate invite_code
- Create host team
- Generate initial squad:
  - 18 players, OVR 50–60
  - Balanced positions (recommend at least: 2 GK, 5 DEF, 5 MID, 4 FWD, +2 flex)
- Create default contracts
- Credit initial budget (ledger entry)

### `joinLeague(invite_code)`
- Validate invite_code
- Ensure league has slots
- Create team + initial squad + initial budget + ledger log

### `sendInvite(league_id, email)`
- Host-only
- Creates invite record (token/code) and sends invite email (service role)

## 6.2 Scheduling + matchdays
### `generateSchedule(league_id, season)`
- Host-only (or admin)
- Creates fixtures for all rounds (round-robin)

### `simulateMatchday(league_id)`
- Host-only
- Must verify status == `IN_SEASON`
- Loads fixtures for `current_round` not simulated
- Simulates each match server-side
- Updates match table + standings
- Decrements injuries and suspensions counters (if active)
- Increments `current_round`
- Audit log: results summary

## 6.3 Packs
### `openPack(team_id, pack_id)`
- Enforce phase (recommended: OFFSEASON only)
- Check budget >= price
- Enforce roster cap
- Deduct price (ledger)
- Generate RNG seed
- Generate player(s) by rating rules (and rarity rules if you define them)
- Create contracts (default 3 years, salary based on OVR scale)
- Assign to team
- Store pack_opening (seed + results) and audit log

## 6.4 Draft (season 2+)
### `startDraft(league_id)`
- Host-only, OFFSEASON only
- Build pick order (inverse of prior standings)
- Create draft_picks (respect traded pick ownership)
- Set draft active

### `makeDraftPick(draft_pick_id, selected_player_id)`
- Manager-only
- Verify pick belongs to manager’s team (current_owner_team_id)
- Verify roster cap
- Assign player to team + create contract
- Mark pick used
- Audit log

## 6.5 Auctions / Free Agency
### `placeBid(player_id, bonus, salary, years)`
- OFFSEASON only
- Player must be free agent
- Check budget >= bonus
- Check roster cap
- Check wage feasibility (salary bill after signing)
- Save bid

### `resolveFreeAgency(league_id)`
- Host-only or scheduled
- For each free agent:
  - rank bids by score (define formula)
  - validate winning team still eligible (budget, roster cap, wage feasibility)
  - assign player, create contract, deduct bonus (ledger)
  - audit log results

## 6.6 Trades + clauses
### `proposeTrade(payload)`
- OFFSEASON only
- Validate ownership of assets (players, picks)
- Validate payer can afford money
- Create trade + trade_items + (optional) objectives as pending

### `acceptTrade(trade_id)`
- OFFSEASON only
- Atomic execution:
  - transfer players (and their contracts’ team_id)
  - transfer picks (current_owner_team_id)
  - transfer money (ledger on both sides)
  - create trade objectives records (pending)
  - enforce roster cap for both teams (post-trade)
- Mark executed + audit log

### `rejectTrade(trade_id)`
- Mark rejected + audit log

### `approveTrade(trade_id)` (optional)
- If your rules require commissioner approval, host-only

## 6.7 Host tools
### `applyFine(team_id, amount, reason)`
- Host-only
- Deduct budget (ledger)
- Audit log

### `injurePlayers(mode, team_id?)`
- Host-only
- Random severity roll + random starter selection
- Set injury_games_remaining and log event

## 6.8 End season (MOST IMPORTANT)
### `endSeason(league_id)`
- Host-only
- Must be idempotent (cannot run twice for same season)
- Steps (all required):
  1) Ensure all fixtures in season are simulated
  2) Finalize standings
  3) Prize money distribution (ledger + update budgets)
  4) Sponsor objectives: apply bonuses/penalties (ledger)
  5) Resolve trade objectives (ledger transfers; mark paid/failed)
  6) Decrement contracts by 1 year
  7) Expire contracts: release players to free agency (team_id NULL)
  8) Wage payment: deduct total annual wages (ledger) (recommended: single debit here)
  9) Compute CompIndex and Stock Value updates
  10) Generate next season draft pool (and/or new draft-eligible players)
  11) Increment league season, reset round, set status=OFFSEASON
  12) Audit log: summary counts and totals

---

# 7) Match Simulation (how to compute results)

## 7.1 Team strength input
Choose one and enforce consistently:
- average OVR of selected starting XI, or
- average OVR of top 11 OVR players, or
- weighted by positions

## 7.2 Randomness
Use server-side secure RNG, optionally seeded for audit.

## 7.3 Goals model (baseline example)
- Convert strength difference into expected goals shift
- Clamp goals to a realistic range (0–6)
- Update match record + standings

## 7.4 Standings update
- Win = 3 points
- Draw = 1
- Loss = 0
- Update goal diff, wins/draws/losses

## 7.5 Stats allocation (optional)
If clauses depend on goals:
- assign scorers randomly from starters, weighted by attacking OVR
- increment player goals, assists

---

# 8) Offseason Systems (rules recap)

## 8.1 Draft
- season 2+
- inverse order of last standings
- picks are assets that can be traded
- draft pool must exist (players/items)

## 8.2 Auctions / Free agency
- bids include signing bonus + salary + years
- bonus is paid immediately upon winning
- salary impacts end-season wage calculation

## 8.3 Trades
- allow: players, money, picks, objectives
- objectives resolved at endSeason

## 8.4 Packs
- recommended: OFFSEASON only to preserve “no mid-season signings”
- must enforce roster cap and budget
- must store seed and results

---

# 9) Finances (ledger-first design)

## 9.1 Budget mutation rule
Budget must never be updated without writing a finance ledger entry.

## 9.2 Typical transactions
Income:
- prize money
- sponsor bonus
- trade incoming cash
- loan draw

Expenses:
- pack purchase
- signing bonus
- trade outgoing cash
- fine
- wage payment
- loan repayments

## 9.3 Wages
Recommended:
- wages are paid once per season at endSeason
- sum of all active contracts’ annual salaries (or a defined wage formula)

---

# 10) Conditional Trade Clauses (Objectives)

Each clause has:
- condition type (player_goals, team_position, champion, etc.)
- payload (player_id + threshold, team_id + rank threshold, etc.)
- payer team + receiver team
- amount
- season_to_check
- status (pending/paid/failed)

Evaluate only in endSeason:
- If condition met → transfer funds + ledger + mark paid
- Else → mark failed

---

# 11) Injuries & Suspensions

## 11.1 Injury generator (host tool)
Suggested model:
- roll 1–50 for severity bucket
- roll 1–11 to select starter index
- set `injury_games_remaining` based on bucket

## 11.2 Enforcement
- injured players cannot be selected in tactics/lineup
- injury countdown decremented after each simulated matchday

Suspensions can mirror injuries with `suspension_games_remaining`.

---

# 12) Realtime + Notifications + Audit

## 12.1 Realtime subscriptions (recommended)
- matches, standings
- roster/players
- finance ledger for your team
- draft picks and selections
- trade status changes
- auction outcomes
- injuries

## 12.2 Notifications (optional but high value)
- matchday completed
- you won/lost an auction
- trade accepted/executed
- contract expired
- injury occurred
- endSeason completed (summary)

## 12.3 Audit logs (mandatory)
Store:
- matchday simulation summaries
- pack openings: seed + results
- endSeason summary totals and counts
- admin fines + injury events
- trade execution summaries

---

# 13) Security & Anti-cheat

- Never trust client for RNG, money, assignments, standings
- Role checks:
  - host-only: simulateMatchday, endSeason, applyFine, injurePlayers, (optional) approveTrade
- Phase checks:
  - OFFSEASON-only: draft picks, auctions, trades, packs
- Atomicity:
  - use DB transactions for: pack opening, trade execution, endSeason, auction resolution
- Idempotency:
  - endSeason and simulateMatchday must not run twice for the same target

---

# 14) GAP AUDIT — Compare to your current Cursor project

Use this checklist to find missing screens/logic.

## A) Missing screens/routes
Confirm these exist and actually work end-to-end:
- Create/Join League + invite flow
- League Lobby
- Dashboard
- Schedule
- Standings
- Squad
- Tactics
- Contracts
- Transactions/Finances
- Loans
- Sponsorships
- CompIndex
- Injuries
- Draft
- Auctions/Free Agents
- Trades
- Packs
- Host Panel
- Audit Logs viewer

## B) Phase locks enforced server-side
Try to do these and confirm server rejects:
- trade during IN_SEASON
- bid during IN_SEASON
- open pack during IN_SEASON (if you adopt offseason-only)

## C) Roster cap enforced everywhere
Test:
- open pack when roster=23+ (should block)
- draft pick when roster=25 (should block)
- accept trade that would make either roster >25 (should block)

## D) EndSeason completeness
Verify endSeason does ALL:
- prize money
- sponsor bonuses
- trade objective settlement
- contract decrement + expiry
- wages deducted
- compIndex update
- draft pool created
- season increment + status=OFFSEASON
- audit log summary

Common missing pieces: wages not charged; expired contracts not releasing players; objectives not evaluated; compIndex never updates.

## E) RNG auditability
Verify:
- pack_openings store results + seed
- matchday logs at least results summary
- users can’t refresh/reroll outcomes

## F) Trades correctness
Verify:
- players move AND their contracts move
- money transfers write ledger entries for both teams
- pick ownership updates
- objectives created and later processed

## G) Auctions correctness
Verify:
- bonus deducted immediately
- salary becomes part of wage bill
- tie-breaker defined
- winning team revalidated (budget/roster) at resolution time

## H) Injuries enforcement
Verify:
- injuries appear on screen
- injured players blocked from XI selection
- countdown decrements matchday-to-matchday

---

# 15) Cursor Prompt to auto-audit your repo

Paste into Cursor after adding this spec file:

> “Scan the repo for all routes/components and edge functions. Cross-check against Section 5 (Screen Map) and Section 6 (Server-Side Functions). Output a report listing: (1) missing screens/routes, (2) missing endpoints, (3) missing validations (phase locks, roster cap, wage feasibility), (4) missing endSeason steps. For each finding, cite the exact file paths and functions/components where it’s implemented or missing.”

---

# IL25 Season Flow + Interaction Windows (Source-of-truth)

## Core rule
**No roster changes during IN_SEASON.**
Roster changes only happen in OFFSEASON (draft / auctions / trades / packs).

---

# 1) League State Machine

League.status enum (recommended):
- PRESEASON_SETUP
- OFFSEASON
- IN_SEASON
- SEASON_END_PROCESSING

Transitions:
1) PRESEASON_SETUP -> OFFSEASON (optional) OR directly -> IN_SEASON (if you skip offseason for Season 1)
2) OFFSEASON -> IN_SEASON (host “Start Season”)
3) IN_SEASON -> SEASON_END_PROCESSING (host “End Season”)
4) SEASON_END_PROCESSING -> OFFSEASON (automatic when endSeason completes)

Required server-side invariant:
- Every write action must validate `league.status` before allowing it.

---

# 2) Season Timeline (Who can do what, when)

## Phase A — PRESEASON_SETUP (league creation + teams join)
**Goal:** get all managers into league and generate their initial teams.

Allowed interactions (Managers):
- Join league via invite code / link
- Create/rename their team (if allowed)
- View dashboard + league lobby

Allowed interactions (Host):
- Send invites
- View team list + roster sizes
- (Optional) Generate schedule
- (Optional) Set season rules (pack availability, auction window, etc.)

Server-side requirements:
- createLeague(): creates league + host role + invite_code
- joinLeague(): creates team + initial squad + initial budget atomically
- Initial squad generation:
  - 18 players (balanced positions)
  - OVR 50–60 (or your defined starter range)
  - Contracts created immediately

Pages involved:
- Create/Join League
- League Lobby
- Profile
- Squad/Team
- Contracts
- Dashboard

---

## Phase B — OFFSEASON (the only time roster changes happen)
**Goal:** all roster movement occurs here, in a predictable order.

Recommended OFFSEASON order (strongly suggested for consistency):

### B1) EndSeason has already created the OFFSEASON state
This means OFFSEASON begins only after endSeason finished:
- prize money applied
- sponsor bonuses applied
- trade objectives resolved (from last season)
- contracts decremented & expired players released
- wages deducted (annual)
- compIndex/stock updated
- draft pool created (if applicable)

So OFFSEASON always starts with a “fresh” league state.

Pages involved:
- Dashboard (should now show OFFSEASON)
- Transactions/Finances (prize money/wages)
- Contracts (decremented years + expirations)
- Free Agents (newly released players visible)
- CompIndex (updated)

---

### B2) Draft Window (Season 2+ only)
**When draft happens:** Early OFFSEASON, before auctions and packs (recommended).
**Who participates:** all teams.

Rules:
- Draft exists only from **Season 2 onward**
- Draft order is based on **previous season standings (inverse)**:
  - last place picks first, champion picks last
- Draft picks are assets and can be traded (if your trade system supports picks)
- Each pick must verify roster cap < 25

How it’s done (minimum viable):
- Host triggers `startDraft()`
  - computes order
  - creates draft_picks records
  - sets draft_active flag/state
- Teams make picks in order via `makeDraftPick(pick_id, player_id)`
- Draft ends when all picks used

Required server-side checks:
- league.status must be OFFSEASON
- verify pick belongs to team (current_owner_team_id)
- verify player is draft-eligible & not already selected
- verify roster cap (<=25)
- contract auto-created for drafted player (rookie scale or default)

Pages involved:
- Draft page (pool, order, current pick, history)
- Dashboard (draft status/your next pick)

---

### B3) Auctions / Free Agents Window
**When:** After draft (recommended), still in OFFSEASON.
**What it is:** sealed bids per free agent.

Rules:
- Managers can bid with:
  - signing_bonus (paid immediately if they win)
  - salary_per_year
  - contract_years
- Winner determined by scoring formula (define and keep consistent), and must be revalidated at resolution time:
  - still has enough budget to pay bonus
  - still won’t break roster cap
  - still won’t break wage feasibility

How it’s done:
- Managers submit bids anytime during the window via `placeBid()`
- Host triggers `resolveFreeAgency()` (or scheduled)
- Winners get player assigned + contract created + bonus deducted

Required server-side checks:
- OFFSEASON only
- player is free agent
- roster cap < 25
- budget >= signing_bonus
- wage feasibility (salary bill check) must pass

Pages involved:
- Free Agents / Auctions page (list + bid form + your active bids)
- Transactions (bonus deductions after win)
- Squad/Contracts (player appears immediately)
- Dashboard (alerts: won/lost bids)

---

### B4) Trades Window
**When:** OFFSEASON only (can run in parallel with auctions if you want, but simplest is after auctions).
**What:** managers propose and accept trades.

Trade can include:
- players
- money
- draft picks (if implemented)
- conditional objectives (clauses to be checked at end of next season)

Rules:
- OFFSEASON only
- atomic execution required
- roster cap must remain <=25 for both teams
- money transfers must write ledger entries
- objectives must be stored as pending records and evaluated in endSeason

Flow:
- proposeTrade()
- acceptTrade() -> executeTrade() atomic
- (Optional) host approval gate

Pages involved:
- Trades page (propose / inbox / history)
- Squad/Contracts (players move)
- Transactions (money moves)
- Draft picks view (if picks moved)
- Dashboard (alerts)

---

### B5) Packs Window (IMPORTANT: where packs are allowed)
**Policy for IL25 (recommended):**
✅ Packs are available ONLY during OFFSEASON  
❌ Packs are NOT available during IN_SEASON

Reason: packs generate new players and would break “no mid-season acquisitions”.

Rules:
- OFFSEASON only
- must enforce roster cap (pack_count players)
- must deduct budget before generating results
- results must be logged with RNG seed (auditability)
- contracts auto-created for generated players

Pages involved:
- Packs page (list pack types + open UI)
- Squad/Contracts (new players)
- Transactions (pack purchase debit)
- Audit logs viewer (seed + results)

---

### B6) Host starts season (transition OFFSEASON -> IN_SEASON)
Host action:
- “Start Season” button sets:
  - status = IN_SEASON
  - current_round = 1 (or 0)
  - schedule exists and is active

Server-side checks:
- can’t start season if schedule missing
- can’t start season if draft_active unresolved (if you enforce)
- can’t start season while auctions unresolved (if you enforce)

Pages involved:
- Host panel
- Schedule (Round 1 visible)
- Dashboard (status changes)

---

## Phase C — IN_SEASON (rosters locked)
**Goal:** simulate matchdays, update standings, track injuries/stats.

Allowed interactions (Managers):
- View schedule/results
- View standings
- Manage tactics/lineup (ONLY within their roster)
- View injuries
- View finances (read-only)
- View contracts (read-only)

Allowed interactions (Host):
- Simulate matchday (advance current_round)
- (Optional) Generate injuries each round (if your rules do host-driven injuries)
- Apply fines

Forbidden (server must reject):
- opening packs
- free agent signings / auctions
- trades
- draft actions

Pages involved:
- Dashboard
- Schedule
- Standings
- Tactics
- Squad
- Injuries
- Host panel

---

## Phase D — SEASON_END_PROCESSING (endSeason)
**Who triggers:** Host only
**What happens:** one atomic script that updates everything.

Mandatory endSeason steps:
1) Ensure all matches simulated
2) Final standings locked
3) Prize money distribution (ledger + budgets)
4) Sponsor bonuses/penalties (ledger + budgets)
5) Resolve trade objectives (conditional clauses)
6) Decrement contracts (years_remaining -= 1)
7) Expire contracts -> players become free agents (team_id NULL)
8) Annual wage payment -> deduct total salaries (ledger)
9) CompIndex + Stock value updates
10) Build next season draft pool (if using)
11) Set league.status = OFFSEASON
12) Write audit log summary

After completion:
- League returns to OFFSEASON and the cycle repeats.

---

# 3) What Cursor must check in your project (Flow Integrity)

## A) UI gating (must match server gating)
For each page:
- If league.status != allowed, UI should show “Not available right now”.
But most important: **server must also block the action.**

Pages requiring strict gating:
- Packs
- Draft
- Free Agents / Auctions
- Trades
- Host controls (simulate matchday, end season)

## B) Server-side validations checklist (must exist on every relevant endpoint)
- league.status is correct
- user is in league
- user owns team / pick / player (where relevant)
- roster cap <= 25 after action
- budget checks for any purchase/bonus
- ledger entry for every budget change
- audit log entry for RNG + admin actions

---

# 4) Cursor prompt to verify your repo end-to-end

“Read the file IL25 Season Flow + Interaction Windows. Now scan all pages/routes and all API/edge functions. Produce a report that:
1) Lists every page and what league.status it supports.
2) Verifies that forbidden actions are blocked server-side (packs/FA/trades/draft during IN_SEASON).
3) Checks roster cap enforcement (<=25) for draft, packs, auctions, trades.
4) Checks that every budget mutation writes a finance ledger row.
5) Checks endSeason includes ALL mandatory steps and flips league.status to OFFSEASON.
For each mismatch, point to the exact file path + function/component name and describe the fix.”