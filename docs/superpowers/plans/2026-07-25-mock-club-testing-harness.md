# Mock Club Live UX Testing Plan

**Goal:** Create credible fictional mock clubs, then use them through the real product UI to find and fix simulation, league-logic, and UX problems.

**Primary verification method:** Live browser use on localhost. Every important behavior must be triggered, observed, and inspected through the same screens a host or manager uses.

## Operating Principles

- Mock behavior is deterministic from a recorded league, season, club, event, and cycle seed.
- Mock clubs use normal product operations and obey the same budgets, ownership, registration, season, and suspension rules as human clubs.
- No external AI, background agents, or usage-credit consumption.
- Dedicated test controls remain compact and can be hidden in production.
- The audit is not complete because an API returned success or a query looks correct. The visible UI must reflect the correct state.
- Desktop and narrow/mobile layouts are both exercised.
- Existing teams are upgraded in place without replacing IDs, squads, finances, fixtures, assets, or history.

## Phase 1: Fictional Club Identities

Build a curated local catalogue containing at least 20 fictional clubs. Each identity includes:

- credible club and city name;
- three-letter acronym;
- primary and secondary colours;
- one of several local SVG badge designs;
- a lightweight behavior personality.

Upgrade the current numbered mock teams in place.

### Live UI checks

1. Open Host Controls and run “Upgrade Mock Clubs.”
2. Confirm the success state states exactly how many clubs changed.
3. Open Schedule, Standings, Simulation, Draft, Trades, Auctions, and a team squad.
4. Confirm the same names and badges appear consistently everywhere.
5. Confirm no “Mock Team 1” style names remain.
6. Confirm badge fallbacks remain legible if an identity is missing.
7. Confirm the real human club remains unchanged.
8. Check badge/name layouts at desktop and mobile widths.

## Phase 2: Compact Mock Testing Controls

Add a testing-only Host Controls card with:

- Add Fictional Clubs;
- Upgrade Existing Mock Clubs;
- Run Mock Activity;
- Current seed/cycle;
- recent activity results.

Do not create a separate strategy-management studio. Activity entries link to the ordinary product screen affected by the action.

### Live UI checks

1. Confirm the card is visible to the host when testing is enabled.
2. Confirm it is absent when testing is disabled.
3. Confirm non-host users cannot invoke its operations.
4. Run a cycle and inspect loading, success, partial-failure, and empty states.
5. Refresh and confirm activity history persists.
6. Follow every activity link and confirm it opens the correct normal workflow.
7. Replay the same seed from the same state and confirm the same proposals appear.

## Phase 3: Transfer Offers and Trades

Mock clubs evaluate squad needs, depth, age, potential, contracts, budgets, player value, cash, draft picks, and upgrade tickets. Incoming offers can be accepted, rejected, or countered.

### Live UI scenarios

1. Offer well above value for a surplus mock player; verify acceptance and visible ownership/finance changes.
2. Make a low offer for a mock club’s only eligible goalkeeper; verify rejection with a useful visible state.
3. Make a near-value offer; verify a credible counter appears and can be accepted or rejected by the human club.
4. Propose cash plus player.
5. Propose a draft pick.
6. Propose an unused upgrade ticket.
7. Attempt to trade a used, listed, or otherwise locked asset; verify the UI explains why it cannot proceed.
8. Try an unaffordable accepted counter; verify no partial ownership mutation occurs.
9. Inspect notifications, transfer history, transaction history, squad pages, and budgets after every completed move.
10. Repeat key flows on mobile and check dialogs, selectors, offer summaries, and action buttons.

## Phase 4: Auctions

Mock clubs value players and tradable tickets, respect £100,000 increments, stop above their valuation, avoid their own listings, and operate only in transfer season.

### Live UI scenarios

1. Create a Dutch auction pool as host, set real deadlines, verify it, and publish it.
2. Run mock activity and observe multiple visible bids from fictional clubs.
3. Confirm all teams can see every bid and current leader.
4. Verify a mock club stops when the next bid exceeds its valuation or budget buffer.
5. List a player in the Auction House with reserve and deadline.
6. Verify sold ownership, seller proceeds, buyer expense, and contract state.
7. Let a player go unsold and verify it stays with the original club.
8. Verify the unsold fee is visible and matches the reserve rule.
9. List and sell an upgrade ticket, then verify the buyer can use it on an eligible prior-season player.
10. Try bidding outside transfer season, on one’s own listing, below the increment, and without budget; inspect the visible errors.
11. Check deadline, bid-entry, leader, empty, loading, sold, and unsold states at desktop and mobile widths.

## Phase 5: Draft and Tradable Assets

Mock selections use squad needs and value rather than always choosing the highest rating. Draft picks and upgrade tickets remain tradable assets.

### Live UI scenarios

1. Enter the correct offseason phase and start the draft as host.
2. Observe mock picks appearing without blocking a human turn.
3. Inspect the selected player’s position against the club’s visible squad gaps.
4. Trade a future/current draft pick and confirm ownership in the Draft UI.
5. Run another mock selection and confirm the current owner makes the pick.
6. Verify mock clubs can choose or trade eligible bonus items.
7. Attempt duplicate, already-used, wrong-season, and unavailable selections.
8. Confirm the draft completes and its UI exits the active state correctly.
9. Check draft order, pick history, selected-player details, badges, and mobile layout.

## Phase 6: Squads, Tactics, and Availability

Mock clubs maintain valid squads and position-aware starting lineups. Suspended and injured players are replaced by sensible eligible alternatives.

### Live UI scenarios

1. Open every fictional club squad and verify roster size and goalkeeper limits.
2. Inspect each starting XI on the tactics pitch.
3. Confirm goalkeepers are in goal and major positional mismatches are penalized visibly.
4. Suspend or injure a starter through real match events.
5. Run mock activity and verify the unavailable player leaves the XI.
6. Confirm the replacement fits the position and the execution/gap indicators change coherently.
7. Confirm the mock change appears in the next match preview and finished report.
8. Check lineup, bench, reserves, player modal, selectors, and pitch placement on desktop and mobile.

## Phase 7: Full Season 3 Match Audit

Use the already-generated 12-team, 22-round Season 3 schedule.

### Round 1 live checks

For each of the six matches:

1. Open Simulation Studio.
2. Preview only that match.
3. Inspect both lineups, position fit, score, events, cards, substitutions, injuries, player ratings, and team statistics.
4. Reroll and verify a different preview is clearly identified.
5. Commit exactly once and verify repeat commit protection.
6. Open the finished match page.
7. Click several players and inspect their complete match-stat modal.
8. Confirm events, player statistics, scoreline, and team totals agree.
9. Return to the match list and verify the completed state.

After all six matches:

1. Confirm Round 1 does not advance early.
2. Confirm it advances to Round 2 after the final match only.
3. Inspect standings, form, goal difference, top scorers, assists, cards, clean sheets, and average ratings.
4. Verify five bookings across separate matches create a one-match suspension.
5. Verify direct-red suspension behavior.
6. Confirm the next preview excludes suspended players.
7. Inspect injuries/suspensions, objectives, finance effects, and notifications.

## Phase 8: Save Isolation

### Live UI scenarios

1. Edit an existing player in the Season 3 audit save.
2. Create a new player in that save.
3. Open another save through the Saves UI.
4. Search for both players and compare attributes.
5. Confirm the edited attributes and new player did not leak.
6. Return to the audit save and confirm its changes remain.

## Issue Handling During the Audit

For each defect:

1. Record the page, actor, league phase, club, seed, and clicks.
2. Capture the visible incorrect result.
3. Identify the underlying cause.
4. Fix the smallest responsible domain or UI behavior.
5. Repeat the identical live steps.
6. Check the neighboring workflow and mobile layout.
7. Mark the item PASS, FIXED, FAIL, or NOT TESTABLE in the audit.

Basic TypeScript/build checks may be run after changes to catch compilation failures, but they do not replace any live UX scenario.

## Completion Evidence

The final audit document must contain:

- all scenarios above and their status;
- recorded seeds for reproducible mock actions;
- match IDs and affected team/player/asset IDs;
- visible before/after evidence for corrected issues;
- any scenario that could not be tested and the exact missing prerequisite;
- confirmation that no other save was changed;
- remaining UX or rules recommendations ranked by severity.
