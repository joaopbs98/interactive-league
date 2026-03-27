# Interactive League 25 (IL25) — Complete Game Guide

A comprehensive guide to the game, its mechanics, every page, and what users and hosts can do.

---

## Table of Contents

1. [Game Overview](#1-game-overview)
2. [Core Concepts](#2-core-concepts)
3. [League Status & Season Cycle](#3-league-status--season-cycle)
4. [User vs Host Roles](#4-user-vs-host-roles)
5. [Page-by-Page Guide](#5-page-by-page-guide)
6. [Game Mechanics](#6-game-mechanics)
7. [Rules & Constraints](#7-rules--constraints)

---

## 1. Game Overview

**Interactive League 25 (IL25)** is a multiplayer football manager simulation where:

- **Managers** own a team in a league, manage their squad, finances, and compete over seasons.
- **Hosts** (commissioners) run the league: advance matchdays, trigger end-of-season, configure sponsors, and manage league settings.
- **Season-based progression**: Roster changes happen only during **OFFSEASON**. During **IN_SEASON**, rosters are locked.
- **Finances** drive decisions: budgets, wages, loans, sponsorships, prize money, stadium revenue, merchandise.
- **Competitions**: Domestic league, UCL, UEL, UECL, Super Cup — with qualification based on prior season standings.

**Golden rule:** All exploitable actions (money, RNG, player assignment, standings) are **server-side** and **atomic**.

---

## 2. Core Concepts

| Concept | Description |
|--------|-------------|
| **League** | A competition with 14 teams, seasons, and status (OFFSEASON / IN_SEASON / etc.) |
| **Team** | A club owned by a manager; has squad, budget, formation, sponsor |
| **Squad** | 21–23 players (at registration); max 25 under contract |
| **CompIndex** | Average OVR of top 14 players; affects draft order and stock price |
| **HOF (Hall of Fame)** | Points from competition performance (UCL/UEL/UECL stages) |
| **Contract** | Player–team binding with salary, years, guaranteed % |
| **Transfer Window** | When open + OFFSEASON: managers can sign, trade, open packs |

---

## 3. League Status & Season Cycle

### League Statuses

| Status | Meaning |
|--------|---------|
| `OFFSEASON` | Roster moves allowed; draft, free agents, trades, packs |
| `IN_SEASON` | Rosters locked; matchdays simulated; tactics/lineup only |
| `SEASON_END_PROCESSING` | Host ran End Season; script running |
| `ARCHIVED` | League ended |

### Season Flow

1. **Create league** → Host creates league, invites members
2. **Join league** → Managers join via invite code; get team + initial squad (21 players) + budget
3. **Host: Generate schedule** → Fixtures created
4. **Host: Start Season** → Status = IN_SEASON
5. **Matchdays** → Host simulates matchdays (or inserts manual results)
6. **Host: End Season** → Runs all end-season logic (prizes, wages, sponsors, stadium, etc.)
7. **Status = OFFSEASON** → Draft, free agents, trades, packs
8. **Host: Start Season** → Next season begins

---

## 4. User vs Host Roles

### Manager (User)

- Manage squad, tactics, lineup
- Sign sponsors (OFFSEASON)
- Participate in draft, free agents, auctions, trades, packs (when allowed)
- View standings, schedule, finances, injuries
- Take loans, sell merchandise % (if levers enabled)
- Configure stadium (visitor focus, confirm VF)

### Host (Commissioner or granted host)

- **League settings**: In Season / Off Season, Transfer Window, Match Mode (SIMULATED / MANUAL)
- **Host teams**: Grant host rights to other team owners
- **Sponsors**: Create custom sponsors, pick 3 league sponsors per season
- **Schedule**: Generate schedule, validate registration
- **Matchdays**: Simulate domestic round, UCL/UEL/UECL/Super Cup matchdays
- **End Season**: Trigger end-of-season processing
- **Injuries**: Generate 3 random injuries
- **Free Agency**: Resolve free agency pool
- **Draft**: Start draft, confirm pool
- **Fines**: Apply fines to teams
- **Stadium**: Set seasonal performance, SC appearance, capacity for teams
- **Add Player**: Add players to teams (host-only)

**Commissioner** = league creator. Host rights can be granted to other teams via Host Teams.

---

## 5. Page-by-Page Guide

### Entry & Onboarding

| Page | Path | Description |
|------|------|-------------|
| **Login** | `/login` | Sign in with email or OAuth |
| **Create League** | `/createleague` | Create a new league (host becomes commissioner) |
| **Join League** | `/joinleague` | Join via invite code |
| **Saves** | `/saves` | List of leagues you're in; select one to continue |

---

### Overview Section

| Page | Path | User | Host |
|------|------|------|------|
| **Season Overview** | `/main/dashboard` | Dashboard: standings, balance, recent/next matches, alerts (registration, contracts, trades) | Same |
| **Objectives** | `/main/dashboard/objectives` | View trade objectives (conditional clauses) and sponsor objectives | Same |
| **CompIndex** | `/main/dashboard/compindex` | View CompIndex, HOF, situation (ABOVE AVERAGE / CAUTION / CRITICAL) per team | Same |

---

### Team Management Section

| Page | Path | User | Host |
|------|------|------|------|
| **Tactics & Formation** | `/main/dashboard/tactics` | Set formation, starting XI, bench, reserves; injured players blocked | Same |
| **Squad** | `/main/dashboard/squad` | View squad, apply upgrade tickets, manage lineup tiers | Same |
| **Contracts** | `/main/dashboard/contracts` | View contracts, expiry, wages | Same |
| **Injuries & Suspensions** | `/main/dashboard/injuries` | View injured/suspended players | Add/remove injuries (host) |

---

### League Section

| Page | Path | User | Host |
|------|------|------|------|
| **Team Comparison** | `/main/dashboard/team-comparison` | Compare squads across teams | Same |
| **Standings** | `/main/dashboard/standings` | Domestic + UCL/UEL/UECL standings | Same |
| **Schedule** | `/main/dashboard/schedule` | View fixtures, results by round | Generate schedule, validate registration |
| **Hall of Fame** | `/main/dashboard/hof` | HOF points by team/season | Same |
| **History & Stats** | `/main/dashboard/stats` | Match history, stats by season | Same |
| **Insert Results** | `/main/dashboard/insert-results` | — | Insert manual match results (MANUAL mode) |
| **Add Player** | `/main/dashboard/add-player` | — | Add player to a team (host only) |
| **Host Controls** | `/main/dashboard/host-controls` | — | Host-only: all league controls |
| **EAFC Setup** | `/main/dashboard/eafc-setup` | Link EAFC account to team | Same |

---

### Bank & Balance Section

| Page | Path | User | Host |
|------|------|------|------|
| **Financial Overview** | `/main/dashboard/finances` | Budget, wage bill, merch revenue, sponsors | Same |
| **Transactions** | `/main/dashboard/transactions` | View transaction history; sell merch % (lever) if enabled | Same |
| **Sponsors** | `/main/dashboard/sponsors` | Sign/change sponsor (OFFSEASON) | Same |
| **Stadium** | `/main/dashboard/stadium` | Set visitor focus, confirm VF | Set seasonal performance, SC appearance, capacity |
| **Loans** | `/main/dashboard/loans` | Take loan, repay, restructure | Same |

---

### Transfer Hub Section

| Page | Path | User | Host |
|------|------|------|------|
| **Transfer History** | `/main/dashboard/transfer-history` | View all transfers in/out | Same |
| **Players Database** | `/main/dashboard/players-database` | Browse all players in league | Same |
| **Packs** | `/main/dashboard/packs` | Open packs (when transfer window open) | Same |
| **Draft** | `/main/dashboard/draft` | Pick when it's your turn | Start draft, confirm pool |
| **Free Agents** | `/main/dashboard/freeagents` | Bid on free agents (when allowed) | Same |
| **Transfer List** | `/main/dashboard/transfer-list` | List players for sale, buy from others | Same |
| **Auctions** | `/main/dashboard/auctions` | Bid on auctioned players | Same |
| **Trades** | `/main/dashboard/trades` | Propose/accept/reject trades | Same |

---

### Other Pages

| Page | Path | Description |
|------|------|-------------|
| **Settings** | `/main/dashboard/settings` | Profile, leave league, delete league (host only) |
| **Host Manual** | `/main/dashboard/host-manual` | Host manual / instructions (linked from Host Controls) |
| **Player** | `/main/dashboard/player` | Individual player view |
| **Squad Player** | `/main/dashboard/squad/player/[playerId]` | Detailed player view from squad |
| **EAFC Setup (Team)** | `/main/dashboard/eafc-setup/[teamId]` | Link EAFC account for a specific team |

---

## 6. Game Mechanics

### 6.1 Squad & Registration

- **Min squad:** 21 players
- **Max squad:** 23 players (at registration)
- **Max under contract:** 25
- **Max goalkeepers:** 3
- Validation at registration (when transfer window closes)

### 6.2 Finances

- **Budget:** Starting + income (prizes, sponsors, stadium, merch, trades) − expenses (wages, packs, fines, penalties)
- **Wage bill:** Sum of salaries with discounts (drafted: 20% → 10% on transfer; packed: 20% → 10% on transfer)
- **Finance reasons:** Prize Money, Sponsor Payment, Sponsor Bonus, Sponsor Failure, Wage Payment, Merchandise, Stadium, Transfer In/Out, Pack Purchase, Trade, etc.

### 6.3 Stadium

- **Visitor Focus:** Core Fanbase | Local Casuals | Tourists | Hospitality & VIP
- **Seasonal Performance:** Host sets after season (UCL Winners, UCL Finalist, etc.)
- **Attendance:** Formula based on capacity, visitor focus, seasonal performance
- **Revenue:** Attendance × ticket price × (games played / 2); paid at end of season (delayed 1 year)

### 6.4 Sponsors

- **Base payment:** Per season
- **Bonus:** If objective met (e.g. Top 4, Champion, UCL Group Stage)
- **Penalty:** If objective not met (repayment, merch penalty)
- **Contract:** 2 seasons; sign only in OFFSEASON

### 6.5 CompIndex

- Average of **top 14 OVR** players
- **Situations:** ABOVE AVERAGE (>82.70), ACCEPTABLE (82.50–82.70), CAUTION (81.46–82.50), CRITICAL (≤81.46)
- **HOF Last 3:** Sum of HOF points from last 3 seasons

### 6.6 Draft (Season 2+)

- **Order:** Top 3 picks = lottery among 3 worst teams; rest = inverse standings
- **Selections:** Specific player, Player of choice (80 OVR max), Merch %, Upgrade Ticket
- **Wage discount:** 20% for drafted players; 10% on transfer

### 6.7 Free Agents

- **Points Value:** Highest bid wins; formula uses contract value, guaranteed %, length
- **Max contract length:** 2 years
- **Guaranteed %:** Min 10% for multi-year; 1-year = 100%
- **Resolve:** Host resolves pool when bids are in

### 6.8 Auctions

- **Bid increment:** €100,000 minimum
- **Reserve fee:** 4% if unsold
- **Validation:** `amount % 100000 === 0` and `amount >= previousHighestBid + 100000`

### 6.9 Loans

- **Interest:** 25% on principal
- **Repayment:** 3 installments
- **Available:** Seasons 2–7
- **Restructure:** 25%, 50%, 75%, 100% defer first repayment; extra interest applies

### 6.10 Merchandise

- **Base:** 30% for all
- **Draft bonus:** +1%, 2.5%, 5%, or 10% from draft picks
- **Top 14 only:** Only top 14 players contribute
- **Sell (lever):** Sell future merch % for immediate payout; 10% transaction cost (if levers enabled)

### 6.11 Injuries

- Host generates 3 random injuries per round (optional)
- Injured players cannot be selected in starting XI
- Games remaining countdown per matchday

### 6.12 Trade Objectives

- Conditional clauses: e.g. "If Top 4, Team A pays Team B €X"
- Resolved at end of season

---

## 7. Rules & Constraints

### Phase Locks

| Phase | Allowed | Forbidden |
|-------|---------|-----------|
| **IN_SEASON** | Tactics, lineup, view data | Trades, FA, auctions, draft, packs (unless transfer window open) |
| **OFFSEASON** | All roster moves | — |

### Roster Limits

- Max 25 players under contract
- 21–23 at registration
- Packs: typically prevent opening if roster > 22

### Wage Feasibility

- Cannot take on wage commitments that exceed available budget

### Server-Side Enforcement

- All phase locks, roster caps, and budget checks are enforced server-side
- UI may hide actions, but server must reject invalid requests

---

## Quick Reference: Host Actions

| Action | When | Host Controls |
|--------|------|---------------|
| Set In Season / Off Season | Anytime | League Settings |
| Transfer Window | Anytime | League Settings |
| Match Mode (SIMULATED / MANUAL) | Anytime | League Settings |
| Generate Schedule | OFFSEASON | Schedule |
| Validate Registration | OFFSEASON | Schedule |
| Simulate Domestic Round | IN_SEASON | Host Controls |
| Simulate UCL/UEL/UECL/Super Cup | IN_SEASON | Host Controls |
| Insert Results | IN_SEASON (MANUAL mode) | Insert Results |
| End Season | IN_SEASON (all matches done) | Host Controls |
| Generate Injuries | IN_SEASON | Host Controls |
| Resolve Free Agency | OFFSEASON | Host Controls |
| Start Draft | OFFSEASON | Host Controls |
| Confirm Pool | OFFSEASON | Host Controls |
| Pick 3 Sponsors | OFFSEASON | Host Controls |
| Apply Fine | Anytime | Host Controls |
| Grant Host Teams | Anytime | Host Controls |
| Stadium (performance, capacity) | OFFSEASON | Stadium |
| Add Player to Team | Anytime | Add Player |

---

*This guide reflects the current implementation. For game logic formulas and moderator rules, see `IL25_GAME_LOGIC_TRUTH.md`.*
