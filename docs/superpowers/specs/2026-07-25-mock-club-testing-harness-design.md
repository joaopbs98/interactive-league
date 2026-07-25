# Mock Club Testing Harness Design

## Purpose

Replace passive numbered mock teams with credible fictional clubs that exercise the same league workflows as human managers. The system exists primarily to expose simulation, rules, logic, and UX defects during development. It will be hidden behind a testing feature flag in production.

## Goals

- Give every mock team a polished fictional identity and local badge.
- Produce varied but exactly reproducible behavior.
- Exercise transfers, trades, auctions, drafts, tradable assets, squad selection, suspensions, and season transitions.
- Route mock actions through the same domain rules and user-facing records as human actions.
- Keep dedicated host tooling small; evaluate results in the normal product UI.
- Record enough information to reproduce and diagnose every decision.

## Non-goals

- No external AI or language-model calls.
- No uncontrolled background agent or continuous job.
- No separate full management interface for mock personalities.
- No attempt to build a multi-season football-director game before the current workflows are audited.

## Fictional Club Identities

A bundled catalogue supplies a stable identity for each mock club:

- name and short name;
- home city;
- primary and secondary colours;
- local SVG badge;
- tactical/market personality;
- stable catalogue key.

The catalogue is curated rather than assembled from random words. Existing numbered mock teams can be upgraded in place without losing players, finances, fixtures, standings, draft assets, or history. Identity keys are unique within a league.

## Deterministic Behavior

All variation uses a seeded pseudo-random generator. The seed is derived from:

`league + season + club + event type + event identifier + activity cycle`

The same state and seed always produce the same decision. A different season or activity cycle produces new behavior. Randomness may break ties or add bounded variation, but it cannot bypass eligibility or financial constraints.

## Decision Model

The recommended model combines utility scoring with a compact persistent personality.

Inputs include:

- positional and registration gaps;
- lineup strength and depth;
- player rating, age, potential, form, contract, salary, and availability;
- club budget and financial buffer;
- offered cash and asset valuation;
- draft board quality and owned pick value;
- auction price, reserve, deadline, and competing bids;
- transfer-season and competition phase;
- personality tendencies such as risk, youth preference, star preference, patience, selling willingness, and price discipline.

The engine returns a proposed action, numeric score, compact reason codes, and the seed used. It never writes league state directly.

## Supported Behavior

### Direct responses

Mock clubs automatically evaluate events addressed to them:

- accept, reject, or counter transfer offers;
- accept, reject, or counter trades containing cash, players, draft picks, or upgrade tickets;
- react to auction bidding where the mock club is eligible;
- resolve their draft turn without blocking a human manager.

### Host-triggered activity cycle

One host action lets mock clubs consider proactive behavior:

- submit a transfer or trade offer;
- list a surplus player or tradable asset during transfer season;
- enter or stop bidding in an auction;
- use or trade draft picks and upgrade tickets;
- repair an invalid lineup;
- replace injured or suspended players;
- make a bounded tactical or squad adjustment.

The cycle produces at most a small configured number of actions per club so tests remain understandable.

## Safety and Domain Boundaries

The decision engine only proposes actions. Existing transfer, trade, auction, draft, finance, registration, ownership, suspension, and season-phase services validate and execute them.

Mock clubs therefore cannot:

- overspend;
- bid on their own listing;
- act outside transfer season where prohibited;
- exceed squad or goalkeeper limits;
- use an already consumed asset;
- select an unavailable draft player;
- field suspended or ineligible players;
- mutate players belonging to another save.

Batch execution records individual success or failure. One invalid proposal does not corrupt unrelated actions.

## Host Controls

The testing-only host surface remains deliberately small:

- **Add Mock Clubs** — fill available slots using unused catalogue identities.
- **Upgrade Existing Mock Clubs** — replace numbered identities in place.
- **Run Mock Activity** — execute one bounded activity cycle.
- **Replay Seed** — rerun a selected cycle from the same pre-action test state where supported.
- **Activity Log** — show club, action, outcome, reason codes, seed, and links to the affected normal UI.

There is no separate mock-club strategy studio. Personality details may appear as compact diagnostic metadata, not as a large editing workflow.

## UX Audit Workflow

Mock-club actions must be inspected through the normal interfaces:

- incoming and outgoing transfer offers;
- trade negotiation and counter-offers;
- Dutch auction and auction-house bidding;
- draft room and pick ownership;
- squad, lineup, injuries, and suspensions;
- finances and transaction history;
- match simulation, match reports, standings, and player leaderboards.

The activity log links into these pages. UX problems found during these runs are fixed in the real interface rather than masked by special testing UI.

## Persistence and Auditability

Mock teams store:

- fictional identity key;
- personality key or compact tendency values;
- current activity-cycle number.

Each decision event stores:

- league, season, and team;
- event/action type;
- relevant entity identifiers;
- seed;
- score and reason codes;
- proposed payload;
- execution outcome and error where applicable;
- timestamp.

Logs avoid generated prose and sensitive credentials.

## Testing Strategy

### Unit tests

- identical inputs and seed produce identical decisions;
- changed seeds produce bounded variation;
- valuation and squad-need scoring behave predictably;
- personality tendencies change choices without overriding hard constraints;
- reason codes match the dominant decision factors.

### Integration tests

- transfer accept/reject/counter paths;
- cash, player, pick, and ticket trades;
- auction bidding and stopping thresholds;
- draft selections and automatic continuation;
- asset ownership and single-use enforcement;
- transfer-season restrictions;
- squad registration and suspension-safe lineups;
- save-scoped player isolation;
- in-place identity upgrades preserve club history.

### Live UX audit

For a seeded test season:

1. Add or upgrade mock clubs.
2. Generate the season schedule.
3. Run transfer-season activity and inspect every affected normal UI.
4. Run draft and auction scenarios.
5. Enter the season and simulate matches individually.
6. Verify lineups, cards, suspensions, results, standings, statistics, and round advancement.
7. Replay important failures with the recorded seed.

## Production Visibility

The creation, upgrade, activity-cycle, replay, and diagnostic-log controls are gated by a testing feature flag. Existing mock clubs may remain valid league data, but no autonomous test cycle runs when the flag is disabled.

## Success Criteria

- Twelve-team test seasons can proceed without mock turns blocking a workflow.
- The same recorded seed reproduces the same proposal set from the same state.
- Mock decisions are financially and positionally plausible.
- Every action is validated by the same rules as a human action.
- Hosts can trace a decision to concise reason codes and navigate to its user-facing result.
- The test harness reveals UX and logic defects without external usage credits.
