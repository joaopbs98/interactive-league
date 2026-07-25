# Interactive League Simulation Engine — Source of Truth

**Status:** Approved product specification  
**Version:** 1.0  
**Date:** 2026-07-18  
**Target:** FC 25 / FC IQ-inspired complete simulation, adapted for Interactive League

## 1. Purpose and authority

This document is the canonical specification for automated match simulation and structured tactics in Interactive League. Code, migrations, UI copy, tests, and calibration must agree with it. When existing behavior conflicts with this document, this document wins until it is deliberately revised.

The engine is inspired by two separable EA FC 25 systems:

1. The reverse-engineered Quick Sim result model, where team overall rating dominates and team results are calculated separately from player event assignment.
2. FC IQ, where formation, build-up, defensive approach, line height, player roles, focuses, and familiarity control positioning and behavior.

Interactive League will reproduce the complete FC 25 tactical vocabulary while building a more transparent and tactically meaningful simulation than EA Quick Sim. It will not claim unknown coefficients as EA facts.

### Evidence labels

- **Confirmed EA behavior:** explicitly supported by the supplied reverse-engineering transcript or EA FC IQ notes.
- **Inference:** strongly implied, but the exact implementation or coefficient is unknown.
- **Interactive League decision:** our chosen behavior, calibration, schema, or UX.

## 2. Non-negotiable product rules

1. Simulation is optional; manual result entry remains supported.
2. Every league/save owns its player attributes, tactical configuration, match events, fatigue, discipline, and statistics. Nothing may mutate the global player pool or another league.
3. The starting XI, bench, formation, roles, focuses, availability, and player attributes at simulation time form an immutable match snapshot.
4. Results are seeded and reproducible. The same engine version, inputs, settings, and seed produce the same output.
5. A match is generated as events, not as a score with decorative events added afterward. The final score is the count of validated goal events.
6. Team quality remains the largest single influence, but tactics create structural consequences rather than flat bonuses.
7. Prestige and club/league reputation are excluded because Interactive League does not maintain trustworthy values for them.
8. Match-importance and rivalry motivation bonuses are excluded. Finals differ through knockout rules and pressure effects, not an arbitrary quality boost.
9. Home advantage is small, generic, configurable, and affects territorial control/refereeing distributions—not a guaranteed score bonus.
10. “Funny Old Game” upset behavior increases variance for meaningful underdogs; it does not award the underdog fixed strength.
11. Hosts receive advanced engine sliders, but all values are bounded and versioned. A validated Balanced preset is the default.
12. Hosts preview a seeded matchday, may reroll once, and then confirm. Confirmation atomically persists results and all consequences.

## 3. What is known from EA FC 25

### 3.1 Quick Sim findings

**Confirmed EA behavior:**

- Team rating has weight `72` in the observed result-input model and dominates the outcome.
- Listed result inputs include team rating, home advantage, FOG, competition strength, match importance, domestic prestige, and a prestige multiplier. Exact weights other than team rating were not established by the transcript.
- Team result generation and goal-scorer assignment are separate systems.
- Individual finishing, pace, passing, and dribbling do not directly decide the winner in the observed result stage; they can affect event attribution elsewhere.
- The first 900 simulated seconds use a different bootstrap phase before possession-aware logic activates.
- Home advantage is the weakest listed result influence.
- FOG means “Funny Old Game” and activates for rating gaps of four or more, increasing upset potential.
- Competition strength contextualizes a team against the average quality of the current competition.
- Fitness is absent from the shown primary result inputs but is used elsewhere.
- Scorer selection uses position plus finishing, heading, long shots, and a negative interceptions/tactical-awareness coefficient.
- Reported scorer coefficients are position `5`, heading `5`, finishing `66`, interceptions `-10`, and long shots `9`. These total `75`, so they are treated as unnormalized coefficients, not confirmed percentages.
- Assist-selection coefficients were not established.

**Do not claim as known:** the missing result weights, exact probability conversion, exact possession logic, assist formula, scoreline distribution, substitutions, cards, injuries, goalkeeper effect, or player-rating formula.

### 3.2 FC IQ tactic composition

**Confirmed EA behavior:** a tactic consists of:

```text
Formation
+ Build-Up Style
+ Defensive Approach
+ Defensive Line Height
+ 11 Player Roles
+ 11 Role Focuses
+ Role Familiarity
```

- Formation is primarily the out-of-possession structure.
- Roles and focuses transform the with-ball structure.
- Build-up controls support movement and transition into attacking positions.
- Defensive approach combines line depth, pressure behavior, and run tracking.
- Player roles govern off-ball position, movement, recovery, width, pressing, and relationships.
- Familiarity affects how reliably a player executes a role, not raw attribute ratings.
- FC IQ diagnostic categories are Attack, Defence, Width, Endurance, Length, and Build-Up.
- Diagnostics are normalized tactical tendencies, not squad-quality ratings. Attack and Defence share a neutral `50` baseline so the goalkeeper/defender composition of every legal XI does not create an artificial permanent Defence advantage. The manager UI labels these as **Attacking intent** and **Defensive cover** to prevent misreading them as player ratings.

## 4. Tactical controls

### 4.1 Build-Up Style

| Value | Behavior | Benefits | Costs |
|---|---|---|---|
| `short_passing` | Players come short; patient, gradual transition | Retention, passing triangles, rest defence | Fewer runs behind, slower attacks against a set block |
| `balanced` | Mixed support and forward runs | Adaptability, neutral risk | No specialized advantage |
| `counter` | Early forward runs and rapid vertical transition | Space attacks, direct threat | Fewer safe outlets, turnover and counter vulnerability |

### 4.2 Defensive Approach and line height

| Value | Allowed height | Default | Pressure/tracking behavior |
|---|---:|---:|---|
| `deep` | 1–30 | 25 | No automatic pressure; defenders drop with runners |
| `balanced` | 31–60 | 50 | Flexible stepping/dropping; neutral pressure |
| `high` | 61–90 | 70 | Situational pressure; compressed shape; defenders rarely drop |
| `aggressive` | 91–100 | 95 | Heavy-touch press; active stepping/offside behavior; high stamina cost |

The API must reject line heights outside the selected approach’s range.

### 4.3 Tactical Focus during a match

- `default`: saved tactic unchanged.
- `attacking`: build-up and defensive approach each move one level more aggressive; compatible role focuses shift one step toward attack/build-up/roaming.
- `defending`: build-up and defensive approach each move one level more conservative; compatible focuses shift toward defend/balanced.

Automatic focus changes are match-state decisions made by the engine. Default Balanced preset behavior:

- Losing by one after minute 70 → Attacking.
- Losing by two after minute 55 → Attacking.
- Winning by one after minute 78 → Defending.
- Red card → recompute shape and prefer Defending unless already losing after minute 70.

### 4.4 Quick tactics

The engine supports timed events for `offside_trap`, `team_press`, `overload_set_pieces`, and `get_in_box`. They are not permanent pre-match settings in v1. They may be triggered by match state and later exposed for interactive simulation.

## 5. Complete FC 25 role catalogue

Every formation slot permits roles for its slot position only. `CF`, `LWB`, and `RWB` remain accepted as legacy player positions, but FC IQ tactical slots map them to `ST`, `LB`, or `RB` behavior.

| Slot | Role | Allowed focuses |
|---|---|---|
| GK | Goalkeeper | Defend, Balanced |
| GK | Sweeper Keeper | Balanced, Build-Up |
| LB/RB | Fullback | Defend, Balanced |
| LB/RB | Wingback | Balanced, Support |
| LB/RB | Falseback | Defend, Balanced |
| LB/RB | Attacking Wingback | Balanced, Attack |
| CB | Defender | Defend, Balanced |
| CB | Stopper | Balanced, Aggressive |
| CB | Ball-Playing Defender | Defend, Build-Up, Aggressive |
| CDM | Holding | Defend, Roaming, Ball-Winning |
| CDM | Centre-Half | Defend |
| CDM | Deep-Lying Playmaker | Defend, Roaming, Build-Up |
| CDM | Wide Half | Defend, Build-Up |
| CM | Box-to-Box | Balanced |
| CM | Holding | Defend, Ball-Winning |
| CM | Deep-Lying Playmaker | Defend, Build-Up |
| CM | Playmaker | Attack, Roaming |
| CM | Half-Winger | Balanced, Attack |
| LM/RM | Winger | Balanced, Attack |
| LM/RM | Wide Midfielder | Defend, Balanced |
| LM/RM | Wide Playmaker | Attack, Build-Up |
| LM/RM | Inside Forward | Balanced, Attack |
| CAM | Playmaker | Balanced, Roaming, Build-Up |
| CAM | Shadow Striker | Attack |
| CAM | Half-Winger | Balanced, Attack |
| CAM | Classic 10 | Attack, Wide |
| LW/RW | Winger | Balanced, Attack |
| LW/RW | Inside Forward | Balanced, Attack, Roaming |
| LW/RW | Wide Playmaker | Attack, Build-Up |
| ST | Advanced Forward | Attack, Complete, Support |
| ST | Poacher | Attack, Support |
| ST | False 9 | Build-Up |
| ST | Target Forward | Balanced, Attack, Wide |

This catalogue includes FC 25 launch roles and the supplied First Frost additions. It intentionally does not import FC 26 changes.

### 5.1 Focus semantics

- `defend`: holds deeper, minimizes forward risk, prioritizes shape.
- `balanced`: context-dependent compromise.
- `attack`: advances, attacks space/box, reduces defensive contribution.
- `build_up`: seeks passing lanes and progression support.
- `roaming`: leaves the nominal zone to find space/coverage; increases fluidity and endurance cost.
- `support`: links phases and contributes to pressing with less extreme attacking positioning.
- `ball_winning`: actively closes/challenges; improves regains but can vacate structure.
- `aggressive`: steps/engages earlier with higher reward, foul risk, and exposure.
- `complete`: mixes link play, runs, and scoring.
- `wide`: moves toward wide channels.

### 5.2 Role structural consequences

Role definitions must be implemented as declarative modifiers, not hard-coded match bonuses. Each role/focus defines:

- with-ball target zone `(x, y)` relative to its formation slot;
- defensive and attacking involvement;
- width and box occupation;
- support distance and run-behind tendency;
- progression, creativity, crossing, and shooting involvement;
- press and recovery contribution;
- transition/rest-defence exposure;
- stamina demand;
- required attribute profile.

Examples:

- Falseback → central overload and stronger rest defence, but reduced natural flank width.
- Attacking Wingback–Attack → width, overlaps, crosses, and box support; large transition exposure.
- Centre-Half → drops into the defensive line, covers advancing fullbacks, reduces final-third presence.
- False 9 → drops to link play and pulls defenders; reduces fixed box presence and creates winger/CAM lanes.
- Poacher–Attack → maximum scoring involvement and runs behind; minimal buildup/defensive contribution.
- Stopper–Aggressive → more early duels/interceptions, fouls, and space behind if beaten.

## 6. Familiarity and positional fit

Interactive League does not reproduce Career Mode coaching progression in v1. Familiarity is calculated per assignment from save-scoped player data:

| Level | Condition | Execution multiplier |
|---|---|---:|
| `role_plus_plus` | Natural slot and strong match to the role’s key attributes | 1.00 |
| `role_plus` | Natural slot or familiar positional group with adequate attributes | 0.94 |
| `base_role` | Familiar group but weak role profile | 0.87 |
| `out_of_position` | Unfamiliar positional group | 0.72 |

Execution multiplier affects positioning reliability, decision success, and stamina efficiency. It does not alter the stored player rating or attributes. Thresholds are calibration constants and must be versioned.

## 7. Engine architecture

### 7.1 Pipeline

```text
Validate fixture and host authority
→ snapshot league settings, teams, lineups, bench, tactics, players, availability
→ derive formation geometry, role behavior, familiarity, and six tactic diagnostics
→ create deterministic PRNG from engine version + league + match + preview attempt
→ bootstrap minutes 0–15
→ simulate possession/event ticks for minutes 16–90+
→ apply state-driven focus changes and substitutions
→ produce shots, goals, assists, cards, injuries, offsides, saves, substitutions
→ calculate player ratings and team statistics
→ return immutable preview
→ host confirms
→ atomically persist match, events, player totals, fatigue, injuries, discipline, standings, progression, and audit log
```

### 7.2 Simulation phases

- Minutes 0–15: lower tactical organization; baseline possession establishes; slightly elevated variance; tactics still influence event eligibility but at reduced strength.
- Minutes 16–90: full structural/tactical model.
- Stoppage time: sampled from event count; maximum 8 minutes per half.
- Knockout draw: extra time in two 15-minute phases, then seeded penalty shootout. Group/domestic league matches may draw.

### 7.3 Team quality and tactical interaction

The engine does not calculate one “team power” and roll a winner. It derives phase-specific capabilities from the XI:

- buildup quality;
- press resistance;
- territorial progression;
- central and wide creation;
- transition attack and defence;
- box presence;
- shot quality and shot stopping;
- set-piece attack/defence;
- stamina and tactical execution.

Starting XI OVR remains the largest common prior. Attributes and tactical structures modify event probabilities and matchup advantages. The default calibrated target is that OVR explains approximately 55–65% of long-run points variance—not a literal per-match percentage—leaving meaningful room for tactics, squad construction, home advantage, availability, and randomness.

### 7.4 Matchup examples

- Counter + fast attackers versus High/Aggressive line → more through-ball transitions and high-quality breakaways.
- Short Passing + technical midfield overload versus weak press → more possession and entries, but not automatically better shots.
- Deep block versus crossing-heavy attack → fewer runs behind, more crosses and edge-of-box shots.
- Aggressive press versus poor composure/ball control → turnovers high up; against press-resistant players it creates exposure.
- Narrow attack versus strong central screen → lower progression unless width roles stretch the block.
- Attacking fullbacks without holding/centre-half cover → better width and chance volume but higher counter vulnerability.

## 8. Event generation

### 8.1 Possessions and chances

Each tick transitions through states:

```text
recovery → buildup → progression → final third → chance → shot → outcome
                  ↘ turnover → transition/counter ↗
```

Team/player attributes and tactical geometry determine transition probabilities. Scorelines are therefore emergent. Poisson distributions are acceptable for calibration comparison, not as the match generator itself.

### 8.2 Shots and goals

Shot type is selected from open-play close shot, long shot, header, set piece, penalty, or direct free kick. Conversion uses shooter attributes, chance quality, pressure, fatigue, body/weak-foot context where available, and goalkeeper attributes.

Scorer involvement begins with the EA-inspired coefficients but normalizes them with role and event context:

```text
base scorer suitability =
  66 × finishing
 + 9 × long_shots
 + 5 × heading_accuracy
 + 5 × role/position involvement
 -10 × interceptions
```

These are coefficients, not percentages. Event type then changes the weights: headers emphasize heading/jumping; long shots emphasize long shots/shot power; penalties emphasize penalties/composure; role box occupation controls eligibility. A 99-finishing forward should be prolific, but cannot receive every goal when not involved in the relevant event.

### 8.3 Assists

Assist selection is an Interactive League decision because EA coefficients were not established. Eligibility comes from the event chain. Weight uses vision, short/long passing, crossing, curve, ball control, role creativity, and the type of chance. Penalties, direct free kicks, solo runs, rebounds, and own goals may have no assist.

### 8.4 Cards and discipline

- Foul probability uses aggression, defensive engagement, tackling mismatch, press intensity, fatigue, and match state.
- Yellow/red outcomes are seeded and referee-variance bounded.
- Two yellows create a red event.
- Persisted cards feed the existing suspension availability model through explicit competition-aware rules.

### 8.5 Injuries and fatigue

- Injury probability uses current fatigue, stamina, match workload, aggressive challenges, and a bounded random component.
- Simulated injuries persist through the existing save-scoped injury fields and event records.
- Fatigue is new save-scoped state. It accumulates from minutes, role endurance cost, pressing, and extra time; it recovers between matchdays according to schedule spacing.
- Fatigue reduces late-match execution and increases injury risk. It never directly rewrites player attributes.

### 8.6 Substitutions

- Only eligible bench players may enter.
- Default maximum: five substitutions in three windows, plus one in extra time.
- Engine decisions respond to injury, card risk, fatigue, score state, positional need, and tactical focus.
- Substitutions change the active role/shape and player event eligibility from their minute onward.

### 8.7 Player ratings

Start at 6.0. Adjust using minutes, goals, assists, shot quality, saves, progression, chance creation, defensive actions, turnovers, cards, penalties, and team result. Clamp to 1.0–10.0. Goalkeepers and outfield roles use different contribution profiles. Ratings are outputs, not inputs into the same match.

## 9. Persistence model

All new records include `league_id` and `season` and are protected by league-scoped RLS.

### 9.1 Team tactics

`team_tactics`

- `id`, `league_id`, `team_id`, `name`, `is_active`
- `formation`, `build_up_style`, `defensive_approach`, `line_height`
- `engine_version`, timestamps
- unique active tactic per team

`team_tactic_assignments`

- `tactic_id`, `slot_index`, `slot_position`, `player_id`
- `role`, `focus`
- unique `(tactic_id, slot_index)`

The active tactic belongs to the team/save. Assignments reference save-scoped `league_players` identity, never mutate the global `player` row.

### 9.2 Engine settings

`simulation_settings`

- one row per league;
- preset and engine version;
- bounded sliders for OVR prior, tactical influence, home advantage, variance, FOG strength, fatigue, injuries, discipline, and goal environment;
- preview reroll allowance defaults to one;
- validation constraint for every range.

Advanced sliders influence documented model parameters; they do not expose arbitrary formulas or SQL.

### 9.3 Preview and snapshots

`simulation_previews`

- league, competition, season, round, attempt, seed, engine/settings version;
- status: `preview`, `committed`, `discarded`, `expired`;
- immutable input snapshot and generated output JSONB;
- creator and timestamps;
- only one active preview per competition/round.

Snapshots contain the exact tactic, players, attributes, availability, and settings used so a committed result remains reproducible after later edits.

### 9.4 Match output

`match_events`

- match, league, season, minute, stoppage minute, sequence;
- team and optional player/secondary-player IDs;
- event type and structured metadata;
- unique sequence per match.

`player_match_stats`

- match, league, team, player;
- starter/substitute, assigned role/focus, minutes, rating;
- goals, assists, shots, shots on target, key passes, passes, completed passes, tackles, interceptions, saves, fouls, cards, fatigue delta;
- unique player per match.

`team_match_stats`

- possession, shots, shots on target, xG, passes, pass accuracy, corners, fouls, offsides, saves;
- tactic diagnostic snapshot and focus changes.

`player_availability_state`

- save-scoped fatigue and card accumulation by competition;
- existing injury/suspension fields remain the availability source during migration, then may be normalized later.

## 10. Public interfaces

### 10.1 Tactics API

`POST /api/team/formation` is extended to accept a versioned `tactic` object containing build-up, defensive approach, line height, and 11 role/focus assignments. The server validates team ownership, formation slots, role compatibility, focus compatibility, player membership, uniqueness, availability, and line-height range in one transaction.

### 10.2 Simulation API

- `POST /api/league/game` with `action: preview_matchday`, competition type, and optional reroll request.
- `POST /api/league/game` with `action: commit_matchday_preview` and preview ID.
- Existing `simulate_matchday` actions become compatibility wrappers or are removed after the host UI migrates.
- Preview returns match cards, scorelines, event summaries, key stats, seed/attempt, warnings, and a commit token. It causes no standings/player consequences.
- Commit verifies the preview is current and uncommitted, then persists everything atomically and advances the appropriate round.

### 10.3 Read APIs

Schedule, stats, player, and match-detail endpoints expose committed team statistics, event timelines, and player match statistics. Preview data is host-only until committed.

## 11. Host and manager UX

### 11.1 Tactics & Formation

- Keep the pitch/drag lineup workflow.
- Add team controls for Build-Up, Defensive Approach, and constrained Line Height.
- Selecting a player/slot opens Role and Focus controls filtered by slot.
- Toggle between Without Ball and With Ball shape.
- Show familiarity and the six diagnostics with concrete strengths/weaknesses.
- Validate missing/invalid roles inline; Balanced defaults must make legacy tactics immediately valid.

### 11.2 Host simulation

- Advanced settings live behind a Balanced preset and “Customize” disclosure.
- Preview displays every fixture, projected score, xG, possession, scorers, cards/injuries, and tactical matchup explanation.
- One reroll is allowed and clearly changes the attempt/seed.
- Confirm dialog lists irreversible consequences. Commit is idempotent and cannot be repeated.

### 11.3 Match detail

- Timeline with goals, assists, cards, injuries, substitutions, and focus changes.
- Score, xG, possession, shots, passing, and discipline comparison.
- Lineups, roles/focuses, player ratings, and match statistics.
- Manual results show a “Manual result” provenance badge and may omit generated event detail.

## 12. Defaults, compatibility, and failure behavior

- Existing teams migrate to `balanced` build-up, `balanced` defence, line height `50`, and position-appropriate Balanced/Defend default roles.
- Incomplete starting XI: preview is blocked with an actionable list; it never silently uses the whole squad.
- Injured/suspended starter: preview is blocked until lineup is corrected.
- Missing bench: simulation proceeds but substitutions are limited and warning is shown.
- Missing player attribute: use the player’s save-scoped OVR-derived neutral fallback for that attribute and record a warning; never read another save’s override.
- Invalid tactic assignment: reject save/preview; do not auto-change a user-selected role.
- Stale preview after lineup/tactic/settings changes: commit fails and requires regeneration.
- Concurrent commit: database lock/idempotency key permits one winner.
- Engine upgrades never change historical previews/results; each snapshot stores its engine version.
- Manual result entry and automated simulation share a single atomic standings/progression writer to prevent drift.

## 13. Calibration targets

Calibration uses thousands of seeded full-season simulations across synthetic and real league snapshots. Balanced defaults target:

- plausible goals per match and home win/draw/away win distributions;
- stronger teams reliably outperform weaker teams over a season without deterministic individual matches;
- rating gaps produce monotonic win-probability changes;
- four-plus-point underdogs receive increased variance without gaining a positive mean advantage;
- tactics change the shape of performance (possession, shot types, xG, transitions), not provide universal winning presets;
- no tactic dominates across all opponents and squad profiles;
- scorer totals correlate strongly with finishing, role involvement, minutes, and team chance volume;
- goalkeeper quality measurably changes shot conversion;
- cards, injuries, fatigue, and substitutions remain within chosen football-realism ranges;
- repeated identical inputs and seed are byte-for-byte deterministic.

Exact numeric targets and coefficients belong in versioned calibration fixtures, not unsupported prose. They become authoritative only after benchmark approval.

## 14. Test and acceptance matrix

### Unit/property tests

- seeded PRNG determinism and distribution sanity;
- every role/focus catalogue entry validates only for allowed slots;
- defensive approach/line-height constraints;
- with-ball geometry and tactic diagnostics;
- familiarity classification;
- monotonic rating-gap behavior across large samples;
- FOG variance only under configured conditions;
- event invariants: goals equal score, assists never exceed goals, no event before entry/after exit, cards/substitutions remain legal;
- save isolation for all player/tactic/event reads and writes.

### Integration tests

- preview has no persistent sporting consequences;
- reroll changes attempt/seed and expires the previous preview;
- commit writes match/events/stats/availability/standings and advances round exactly once;
- stale and concurrent commits fail safely;
- domestic, group, knockout, extra-time, penalties, and Super Cup paths;
- manual and simulated results update shared standings/progression consistently;
- season-end objectives consume simulated goals/assists correctly.

### UX acceptance

- manager can configure every FC 25 role/focus without memorizing compatibility;
- with/without-ball preview clearly explains structural changes;
- host can understand why a preview favored a team without seeing proprietary coefficients;
- desktop and mobile tactics, preview, and match-detail flows are usable by keyboard and screen reader;
- live testing covers legacy migrated tactic, full configuration, invalid lineup, preview, reroll, commit, and result inspection.

## 15. Implementation order

1. Versioned TypeScript tactic domain model and complete role catalogue.
2. Save-scoped tactic/settings/preview/event/stat schema and RLS.
3. Tactics API migration and legacy defaults.
4. FC IQ controls, role editor, with/without-ball view, diagnostics.
5. Pure deterministic simulation library with fixtures and calibration harness.
6. Preview and atomic commit service; shared result writer.
7. Host preview/settings UI and match-detail UI.
8. Full-season calibration, regression gates, and controlled engine-version rollout.

## 16. Source references

- User-supplied reverse-engineering transcript and corrections, 2026-07-18.
- User-supplied FC 25 FC IQ role/focus synthesis, 2026-07-18.
- EA SPORTS FC 25, “FC IQ Deep Dive.”
- EA SPORTS FC 25, “First Frost Update.”
- EA SPORTS FC 25, “Career Mode Deep Dive.”
- Existing Interactive League implementation: starting-XI OVR helper, `simulate_single_match`, matchday RPCs, tactics page, formation API, save-scoped league-player architecture.

This specification reproduces the supplied FC 25 tactical system completely at the vocabulary and behavioral level. Where EA’s numeric internals are unknown, Interactive League uses transparent, versioned, testable calibration rather than invented claims.
