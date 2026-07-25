# Mock Club Testing Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build reproducible fictional mock clubs that exercise the league’s real transfers, trades, auctions, drafts, assets, squads, and season workflows for UX and logic testing.

**Architecture:** A pure deterministic decision package proposes mock-club actions from explicit league snapshots. A thin orchestration service loads data and submits proposals through the existing domain operations; it never bypasses their validation. Host Controls exposes only creation/upgrade, one-cycle execution, replay metadata, and an activity log, guarded by `ENABLE_MOCK_CLUB_TESTING`.

**Tech Stack:** Next.js App Router, TypeScript, JavaScript ES modules for pure domain logic, Supabase/PostgreSQL migrations and RPCs, Node test runner, React, Tailwind CSS, local SVG assets.

## Global Constraints

- Do not use external AI, language-model calls, scheduled jobs, or uncontrolled background agents.
- Derive each deterministic seed from league ID, season, team ID, event type, event ID, and activity-cycle number.
- Mock proposals must pass through the same transfer, trade, auction, draft, finance, registration, ownership, suspension, and season-phase rules as human actions.
- Preserve every existing club’s players, finances, fixtures, standings, assets, picks, and history when upgrading its identity.
- Scope every player lookup and mutation to one league/save.
- Hide all mock-testing controls unless `ENABLE_MOCK_CLUB_TESTING=true`.
- Store compact reason codes and structured inputs; do not generate prose explanations.
- Follow red-green-refactor for every behavior change.

---

## File Structure

- `lib/mock-clubs/catalogue.mjs` — curated fictional identities and personality presets.
- `lib/mock-clubs/random.mjs` — stable hashing and seeded pseudo-random helpers.
- `lib/mock-clubs/types.ts` — shared TypeScript contracts for snapshots, proposals, and logs.
- `lib/mock-clubs/decision-engine.mjs` — pure valuation and action-proposal functions.
- `lib/mock-clubs/activity-service.ts` — database snapshot loading and validated action orchestration.
- `lib/mock-clubs/executors.ts` — adapters that call existing domain operations.
- `components/mock-clubs/ClubBadge.tsx` — local badge renderer.
- `components/mock-clubs/MockActivityLog.tsx` — compact diagnostic activity list.
- `app/api/league/mock-clubs/route.ts` — host-only testing endpoint.
- `supabase/migrations/148_mock_club_testing_harness.sql` — identity, personality, cycle, and decision-event persistence.
- `tests/mock-club-random.test.mjs` — reproducibility tests.
- `tests/mock-club-catalogue.test.mjs` — catalogue integrity tests.
- `tests/mock-club-decisions.test.mjs` — behavior tests.
- `tests/mock-club-integration.test.mjs` — validation-boundary tests.

---

### Task 1: Deterministic Randomness and Fictional Club Catalogue

**Files:**
- Create: `lib/mock-clubs/random.mjs`
- Create: `lib/mock-clubs/catalogue.mjs`
- Create: `tests/mock-club-random.test.mjs`
- Create: `tests/mock-club-catalogue.test.mjs`

**Interfaces:**
- Produces: `createDecisionSeed(parts: string[]): string`
- Produces: `createSeededRandom(seed: string): () => number`
- Produces: `pickSeeded<T>(items: T[], random: () => number): T`
- Produces: `MOCK_CLUB_CATALOGUE`
- Produces: `availableMockClubs(usedIdentityKeys: string[])`

- [ ] **Step 1: Write failing deterministic-random tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createDecisionSeed, createSeededRandom } from "../lib/mock-clubs/random.mjs";

test("the same decision coordinates reproduce the same sequence", () => {
  const seed = createDecisionSeed(["league-1", "3", "team-1", "trade", "offer-9", "2"]);
  const first = createSeededRandom(seed);
  const second = createSeededRandom(seed);
  assert.deepEqual([first(), first(), first()], [second(), second(), second()]);
});

test("changing the activity cycle changes the sequence", () => {
  const a = createSeededRandom(createDecisionSeed(["league-1", "3", "team-1", "cycle", "none", "2"]));
  const b = createSeededRandom(createDecisionSeed(["league-1", "3", "team-1", "cycle", "none", "3"]));
  assert.notDeepEqual([a(), a(), a()], [b(), b(), b()]);
});
```

- [ ] **Step 2: Run the tests and verify the missing-module failure**

Run: `node --test tests/mock-club-random.test.mjs`

Expected: FAIL because `lib/mock-clubs/random.mjs` does not exist.

- [ ] **Step 3: Implement stable hashing and a small deterministic PRNG**

Use 32-bit integer operations only. `createDecisionSeed` must length-prefix each input part before hashing so `["ab", "c"]` cannot collide trivially with `["a", "bc"]`. `createSeededRandom` must return values in `[0, 1)`.

- [ ] **Step 4: Run deterministic-random tests**

Run: `node --test tests/mock-club-random.test.mjs`

Expected: PASS.

- [ ] **Step 5: Write failing catalogue-integrity tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { MOCK_CLUB_CATALOGUE, availableMockClubs } from "../lib/mock-clubs/catalogue.mjs";

test("catalogue provides at least twenty unique complete identities", () => {
  assert.ok(MOCK_CLUB_CATALOGUE.length >= 20);
  assert.equal(new Set(MOCK_CLUB_CATALOGUE.map((club) => club.key)).size, MOCK_CLUB_CATALOGUE.length);
  assert.equal(new Set(MOCK_CLUB_CATALOGUE.map((club) => club.name)).size, MOCK_CLUB_CATALOGUE.length);
  for (const club of MOCK_CLUB_CATALOGUE) {
    assert.match(club.acronym, /^[A-Z]{3}$/);
    assert.match(club.primaryColor, /^#[0-9A-F]{6}$/i);
    assert.match(club.secondaryColor, /^#[0-9A-F]{6}$/i);
    assert.ok(["builder", "seller", "prospect_hunter", "star_chaser", "conservative", "aggressive"].includes(club.personality));
  }
});

test("used identities are excluded without changing catalogue order", () => {
  const remaining = availableMockClubs([MOCK_CLUB_CATALOGUE[0].key]);
  assert.equal(remaining[0].key, MOCK_CLUB_CATALOGUE[1].key);
});
```

- [ ] **Step 6: Run the catalogue tests and verify failure**

Run: `node --test tests/mock-club-catalogue.test.mjs`

Expected: FAIL because the catalogue module does not exist.

- [ ] **Step 7: Add twenty curated fictional identities**

Each record must contain:

```js
{
  key: "porto_vigil",
  name: "Porto Vigil",
  shortName: "Vigil",
  acronym: "PVG",
  city: "Porto",
  primaryColor: "#173B67",
  secondaryColor: "#E8B44A",
  badge: "shield_star",
  personality: "builder"
}
```

Use distinct names, cities, palettes, badge-template keys, and a balanced distribution of the six personalities.

- [ ] **Step 8: Run both test files**

Run: `node --test tests/mock-club-random.test.mjs tests/mock-club-catalogue.test.mjs`

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add lib/mock-clubs/random.mjs lib/mock-clubs/catalogue.mjs tests/mock-club-random.test.mjs tests/mock-club-catalogue.test.mjs
git commit -m "feat(mock-clubs): add seeded identities"
```

---

### Task 2: Persistence and In-place Identity Upgrades

**Files:**
- Create: `supabase/migrations/148_mock_club_testing_harness.sql`
- Modify: `database.types.ts`
- Create: `tests/mock-club-migration.test.mjs`

**Interfaces:**
- Produces team columns: `mock_identity_key`, `mock_personality`, `mock_activity_cycle`
- Produces table: `mock_club_decisions`
- Produces RPC: `upgrade_mock_club_identities(p_league_id uuid, p_actor_user_id uuid, p_assignments jsonb)`

- [ ] **Step 1: Write a failing migration-contract test**

Read the migration as text and assert that it:

```js
assert.match(sql, /ADD COLUMN IF NOT EXISTS mock_identity_key TEXT/);
assert.match(sql, /ADD COLUMN IF NOT EXISTS mock_personality TEXT/);
assert.match(sql, /ADD COLUMN IF NOT EXISTS mock_activity_cycle INTEGER NOT NULL DEFAULT 0/);
assert.match(sql, /CREATE TABLE IF NOT EXISTS mock_club_decisions/);
assert.match(sql, /UNIQUE \(league_id, mock_identity_key\)/);
assert.match(sql, /CREATE OR REPLACE FUNCTION upgrade_mock_club_identities/);
assert.match(sql, /user_id IS NULL/);
```

- [ ] **Step 2: Run the migration test and verify failure**

Run: `node --test tests/mock-club-migration.test.mjs`

Expected: FAIL because migration 148 does not exist.

- [ ] **Step 3: Create the migration**

Add nullable identity/personality fields and a non-negative activity-cycle field to `teams`. Add a partial unique index for non-null identity keys per league. Create `mock_club_decisions` with league/team/season/event/action/entity/seed/score/reason-codes/proposal/outcome/error/timestamps. Enable RLS and allow league hosts to read logs; writes occur only through the service role.

The upgrade RPC accepts catalogue-validated assignments shaped as
`[{ teamId, identityKey, name, acronym, primaryColor, secondaryColor, badgeKey, personality }]`
and must:

1. verify the actor is the league commissioner;
2. lock userless teams without an identity;
3. assign caller-supplied catalogue identity data without replacing team IDs;
4. update only name, acronym, colours, badge key, identity, and personality;
5. write one audit-log record per upgraded team;
6. leave squads, finances, assets, fixtures, results, and history untouched.

- [ ] **Step 4: Update generated database types for the new columns/table**

Represent `reason_codes` as `string[]`, `proposal` as JSON, `score` as number, and `mock_activity_cycle` as number.

- [ ] **Step 5: Run the migration-contract test and TypeScript**

Run: `node --test tests/mock-club-migration.test.mjs`

Run: `.\node_modules\.bin\tsc.cmd --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add supabase/migrations/148_mock_club_testing_harness.sql database.types.ts tests/mock-club-migration.test.mjs
git commit -m "feat(mock-clubs): persist test agents"
```

---

### Task 3: Pure Valuation and Decision Engine

**Files:**
- Create: `lib/mock-clubs/decision-engine.mjs`
- Create: `lib/mock-clubs/types.ts`
- Create: `tests/mock-club-decisions.test.mjs`

**Interfaces:**
- Produces: `evaluateIncomingOffer(snapshot, offer, random): MockProposal`
- Produces: `chooseDraftSelection(snapshot, candidates, random): MockProposal`
- Produces: `chooseAuctionAction(snapshot, auction, random): MockProposal`
- Produces: `planActivityCycle(snapshot, opportunities, random): MockProposal[]`

`MockProposal`:

```ts
type MockProposal = {
  teamId: string;
  action:
    | "accept_offer" | "reject_offer" | "counter_offer"
    | "place_bid" | "stop_bidding"
    | "make_draft_pick" | "propose_trade"
    | "list_asset" | "use_upgrade_ticket"
    | "repair_lineup";
  score: number;
  reasonCodes: string[];
  payload: Record<string, unknown>;
};
```

- [ ] **Step 1: Write failing transfer-decision tests**

Cover:

- accepting an above-market cash offer for a surplus player;
- rejecting an under-market offer for the only eligible goalkeeper;
- countering when value is close and personality permits negotiation;
- rejecting any action that would breach the configured financial buffer;
- valuing draft picks and unused upgrade tickets as tradable assets;
- reproducing the same action with the same seed.

- [ ] **Step 2: Run transfer tests and verify missing exports**

Run: `node --test --test-name-pattern="offer|asset|seed" tests/mock-club-decisions.test.mjs`

Expected: FAIL because the decision engine does not exist.

- [ ] **Step 3: Implement player, cash, pick, and ticket valuation**

Use normalized utility components:

```js
playerValue = marketValue
  * positionNeedMultiplier
  * agePotentialMultiplier
  * contractMultiplier
  * availabilityMultiplier;
```

Personality may adjust soft multipliers by at most 15%. It cannot alter hard eligibility or ownership facts.

- [ ] **Step 4: Implement accept/reject/counter thresholds**

- Accept when incoming utility is at least 108% of outgoing utility.
- Reject below 92%.
- Between 92% and 108%, counter toward 105% unless the personality is conservative or the player is essential.
- Include dominant reason codes from `SQUAD_NEED`, `SURPLUS_PLAYER`, `PRICE_TOO_LOW`, `PRICE_TOO_HIGH`, `LOW_BUDGET`, `ASSET_VALUE`, and `CONTRACT_RISK`.

- [ ] **Step 5: Run transfer-decision tests**

Expected: PASS.

- [ ] **Step 6: Add failing auction and draft tests**

Cover:

- bidding up to a personality-adjusted valuation while retaining the financial buffer;
- never bidding on the club’s own listing;
- stopping after the next required increment exceeds valuation;
- preferring the strongest draft candidate that fills a material squad gap;
- permitting a star chaser to take a clearly superior player despite a smaller positional need;
- returning no draft action when no eligible candidate exists.

- [ ] **Step 7: Run auction/draft tests and verify expected failures**

Run: `node --test --test-name-pattern="auction|draft" tests/mock-club-decisions.test.mjs`

Expected: FAIL because auction and draft functions are not implemented.

- [ ] **Step 8: Implement auction and draft decisions**

Use the existing £100,000 auction increment, current bid, reserve, ownership, deadline, budget, and candidate eligibility. Use squad gaps first, quality second, then seeded tie-breaking.

- [ ] **Step 9: Add failing proactive-cycle tests**

Assert that one activity cycle:

- emits no more than three proposals per club;
- emits no market actions while transfer season is closed;
- repairs a lineup containing a suspended player before proposing market actions;
- can list surplus players, propose trades, or use tradable assets during transfer season;
- does not produce mutually conflicting proposals for the same asset.

- [ ] **Step 10: Implement bounded proactive planning**

Sort opportunities by utility, remove conflicts by entity ID, prioritize lineup eligibility, and return the top three positive proposals.

- [ ] **Step 11: Run the full decision suite**

Run: `node --test tests/mock-club-decisions.test.mjs`

Expected: PASS.

- [ ] **Step 12: Commit Task 3**

```bash
git add lib/mock-clubs/decision-engine.mjs lib/mock-clubs/types.ts tests/mock-club-decisions.test.mjs
git commit -m "feat(mock-clubs): score league decisions"
```

---

### Task 4: Validated Executors and Activity Orchestration

**Files:**
- Create: `lib/mock-clubs/executors.ts`
- Create: `lib/mock-clubs/activity-service.ts`
- Create: `tests/mock-club-integration.test.mjs`
- Create: `supabase/migrations/149_mock_draft_decision_hook.sql`

**Interfaces:**
- Produces: `runMockActivityCycle(db, leagueId, actorUserId): Promise<ActivityCycleResult>`
- Produces: `respondToMockClubEvent(db, event): Promise<ExecutionResult>`
- Produces: `executeMockProposal(db, proposal): Promise<ExecutionResult>`

- [ ] **Step 1: Write failing executor-boundary tests**

Use a recording domain adapter and assert that:

- transfer proposals call the existing transfer operation;
- trade proposals call the existing trade operation;
- bids call `place_auction_bid`;
- draft selections call `make_draft_pick`;
- ticket use calls the existing upgrade-ticket operation;
- lineup repair calls the same position-aware lineup selector used by match simulation;
- no executor performs direct player/team ownership updates.

- [ ] **Step 2: Run executor tests and verify missing-module failure**

Run: `node --test tests/mock-club-integration.test.mjs`

Expected: FAIL because the executor module does not exist.

- [ ] **Step 3: Implement executor adapters**

Each adapter returns `{ success, outcome, error }`, captures domain validation failures without retry loops, and never converts an invalid action into a direct database update.

- [ ] **Step 4: Run executor tests**

Expected: PASS.

- [ ] **Step 5: Add failing activity-cycle tests**

Assert that the service:

- loads only `user_id IS NULL` teams for the requested league;
- increments and persists one cycle number atomically;
- derives one seed per proposal;
- stores every proposal and execution outcome;
- keeps processing other clubs after one proposal fails;
- does nothing when `ENABLE_MOCK_CLUB_TESTING` is not `"true"`;
- never reads league players without a matching league ID.

- [ ] **Step 6: Implement the activity service**

Load a compact snapshot per club, call `planActivityCycle`, execute proposals sequentially per club, and allow clubs to run concurrently only after tests prove actions cannot touch the same entity. Initially use sequential league-wide execution for deterministic ordering.

- [ ] **Step 7: Replace highest-rating-only mock drafting**

Migration 149 changes the draft hook so a mock pick is resolved by the application decision service when available. Retain a safe SQL fallback that chooses the highest-rated eligible player only when no host-triggered service is running, preventing the draft from blocking.

- [ ] **Step 8: Run integration tests and TypeScript**

Run: `node --test tests/mock-club-integration.test.mjs`

Run: `.\node_modules\.bin\tsc.cmd --noEmit`

Expected: PASS.

- [ ] **Step 9: Commit Task 4**

```bash
git add lib/mock-clubs/executors.ts lib/mock-clubs/activity-service.ts tests/mock-club-integration.test.mjs supabase/migrations/149_mock_draft_decision_hook.sql
git commit -m "feat(mock-clubs): execute validated actions"
```

---

### Task 5: Host-only API and Compact Testing Controls

**Files:**
- Create: `app/api/league/mock-clubs/route.ts`
- Modify: `app/main/dashboard/host-controls/page.tsx`
- Create: `components/mock-clubs/MockActivityLog.tsx`
- Create: `tests/mock-club-api.test.mjs`

**Interfaces:**
- `GET /api/league/mock-clubs?leagueId=...` returns feature availability, mock clubs, current cycles, and recent activity.
- `POST /api/league/mock-clubs` accepts actions `add`, `upgrade`, or `run_cycle`.

- [ ] **Step 1: Write failing API contract tests**

Assert:

- unauthenticated requests return 401;
- non-host requests return 403;
- disabled feature returns 404;
- `add` fills only open league slots;
- `upgrade` preserves team IDs;
- `run_cycle` returns counts for proposed, succeeded, and failed actions;
- all actions require a league ID and an allowed action name.

- [ ] **Step 2: Run API tests and verify missing-route failure**

Run: `node --test tests/mock-club-api.test.mjs`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the host-only API**

Use authenticated user lookup plus the existing commissioner check. Catalogue selection excludes identities already used in the league. Return compact structured errors without exposing internal credentials or service-role details.

- [ ] **Step 4: Run API tests**

Expected: PASS.

- [ ] **Step 5: Add the compact Host Controls card**

When enabled, display:

- current number of mock clubs;
- `Add Fictional Clubs`;
- `Upgrade Numbered Clubs`;
- `Run Mock Activity`;
- current season and each club’s latest cycle;
- the last 25 activity entries through `MockActivityLog`.

Each log row shows badge, club, action, success/failure, reason-code chips, seed copy button, and a link to the affected normal product page. Do not add personality editors or a separate strategy studio.

- [ ] **Step 6: Verify disabled and enabled states**

Run once without `ENABLE_MOCK_CLUB_TESTING` and confirm the card is absent. Run with `ENABLE_MOCK_CLUB_TESTING=true` and confirm only a host can load and use it.

- [ ] **Step 7: Run TypeScript and focused tests**

Run: `.\node_modules\.bin\tsc.cmd --noEmit`

Run: `node --test tests/mock-club-api.test.mjs tests/mock-club-integration.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit Task 5**

```bash
git add app/api/league/mock-clubs/route.ts app/main/dashboard/host-controls/page.tsx components/mock-clubs/MockActivityLog.tsx tests/mock-club-api.test.mjs
git commit -m "feat(host): control mock club testing"
```

---

### Task 6: Proper Badges Across Existing Product UI

**Files:**
- Create: `components/mock-clubs/ClubBadge.tsx`
- Modify: `app/main/dashboard/schedule/page.tsx`
- Modify: `app/main/dashboard/standings/page.tsx`
- Modify: `app/main/dashboard/simulation/page.tsx`
- Modify: `app/main/dashboard/matches/[matchId]/page.tsx`
- Modify: `app/main/dashboard/trades/page.tsx`
- Modify: `app/main/dashboard/auctions/page.tsx`
- Modify: `app/main/dashboard/draft/page.tsx`
- Create: `tests/mock-club-badge.test.mjs`

**Interfaces:**
- Produces: `<ClubBadge badgeKey primaryColor secondaryColor acronym size />`

- [ ] **Step 1: Write failing badge-template tests**

Assert that every catalogue `badge` key is supported, rendered SVG has a title/accessible label, colours are supplied through attributes rather than unsafe HTML, and unknown keys use a neutral shield.

- [ ] **Step 2: Run badge tests and verify missing-component support**

Run: `node --test tests/mock-club-badge.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement six reusable local SVG badge templates**

Create shield, roundel, diamond, tower, wings, and star templates. Render text as the three-letter acronym and set `aria-label` to the club name. Do not fetch remote images.

- [ ] **Step 4: Run badge tests**

Expected: PASS.

- [ ] **Step 5: Integrate badges into normal workflows**

Show the same compact badge component anywhere teams are compared or act:

- schedule fixture rows;
- standings;
- simulation match list;
- finished match report;
- trades and offers;
- auctions and bids;
- draft order and selection history.

Keep names visible; badges never become the only identity cue.

- [ ] **Step 6: Run TypeScript**

Run: `.\node_modules\.bin\tsc.cmd --noEmit`

Expected: PASS.

- [ ] **Step 7: Commit Task 6**

```bash
git add components/mock-clubs/ClubBadge.tsx app/main/dashboard/schedule/page.tsx app/main/dashboard/standings/page.tsx app/main/dashboard/simulation/page.tsx app/main/dashboard/matches/[matchId]/page.tsx app/main/dashboard/trades/page.tsx app/main/dashboard/auctions/page.tsx app/main/dashboard/draft/page.tsx tests/mock-club-badge.test.mjs
git commit -m "feat(ui): show fictional club badges"
```

---

### Task 7: Seeded End-to-End UX Audit

**Files:**
- Create: `docs/audits/mock-club-season-3-ux-audit.md`
- Modify only the product files implicated by reproducible failures.
- Add one regression test per confirmed logic defect before its fix.

**Interfaces:**
- Consumes the completed testing harness.
- Produces a reproducible audit record with league, season, cycle, seed, action, expected result, actual result, and resolution.

- [ ] **Step 1: Establish the Season 3 baseline**

Confirm through the UI:

- 12 registered clubs;
- 22 rounds and 132 domestic fixtures;
- Round 1 is current;
- every club has 21–23 players and no more than three goalkeepers;
- all numbered mock clubs are upgraded without new team IDs.

- [ ] **Step 2: Run a transfer-season mock cycle**

Inspect the real transfer, trade, auction, draft, finance, transaction, squad, and notification pages. Record each confusing state, missing status, invalid action, stale refresh, incorrect badge/name, and rules mismatch.

- [ ] **Step 3: Reproduce each confirmed defect**

Use its recorded seed and pre-action state. Write a failing automated regression test before changing product code.

- [ ] **Step 4: Fix and live-retest affected UX**

Re-run the same seed, verify the automated test passes, and repeat the original clicks in the live UI at desktop and mobile widths.

- [ ] **Step 5: Enter the season and simulate Round 1 one match at a time**

For all six matches:

- preview and reroll;
- inspect lineups, position efficiency, events, player statistics, and team statistics;
- commit exactly once;
- open the finished report;
- open individual player-stat modals;
- confirm cards and suspensions;
- confirm standings and player leaderboards;
- confirm current round advances to Round 2 only after all six matches finish.

- [ ] **Step 6: Run suspension and lineup-repair scenarios**

Accumulate five bookings across distinct matches and verify a one-match suspension. Verify direct-red behavior. Run a mock cycle and confirm suspended players are removed from the XI with a position-appropriate replacement.

- [ ] **Step 7: Verify save isolation**

Edit and create a player in the audit league, then inspect another save and confirm ratings, attributes, ownership, and custom-player existence are unchanged.

- [ ] **Step 8: Complete the audit document**

Classify every requirement as PASS, FIXED, FAIL, or NOT TESTABLE. For FIXED items include the regression test and live retest evidence. For NOT TESTABLE items state the missing test fixture or account.

- [ ] **Step 9: Run the full verification suite**

Run: `node --test tests/*.test.mjs`

Run: `.\node_modules\.bin\tsc.cmd --noEmit`

Run: `npm run build`

Expected: all commands exit 0 with no new warnings attributable to this work.

- [ ] **Step 10: Commit the audit and final regression fixes**

```bash
git add docs/audits/mock-club-season-3-ux-audit.md tests app lib components supabase/migrations
git commit -m "test: audit seeded mock club season"
```

---

## Plan Self-review

- Spec coverage: identities, badges, deterministic behavior, transfers, trades, auctions, drafts, tradable assets, squad repair, suspensions, season phases, reason codes, feature gating, activity logs, save isolation, and live UX auditing are assigned to Tasks 1–7.
- Scope control: the engine proposes actions only; existing domain services remain authoritative. No separate strategy studio or background autonomous system is introduced.
- Type consistency: decision functions produce `MockProposal`; executors consume `MockProposal`; activity results persist to `mock_club_decisions`; API and UI read those same records.
- Dependency order: Tasks 1–3 are pure foundations, Task 4 orchestrates them, Task 5 exposes them, Task 6 integrates identity presentation, and Task 7 performs live verification.
