# Auction Systems Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver host-curated Dutch Auctions and manager-run Auction House listings for players and unused upgrade tickets, restricted to `OFFSEASON` and verified through the live UI.

**Architecture:** Extend the existing `auctions` and `bids` tables into one generalized lot engine. Keep money, ownership, locking, and settlement in transactional PostgreSQL functions; expose thin authenticated Next.js routes and two focused UI entry points.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript/JavaScript, Supabase PostgreSQL/RPC, Tailwind, Radix UI, Node built-in test runner.

## Global Constraints

- All creation, publication, bidding, cancellation, and settlement actions require league status `OFFSEASON`.
- Bids are public and increase in exact $100,000 increments.
- Unsold fee is zero for zero reserve; otherwise `max(100000, round(reserve * 0.04 / 100000) * 100000)`.
- Unsold player and ticket assets remain with the original club.
- Active listings lock their asset against use, transfer, release, or duplicate listing.
- No new dependencies.

---

### Task 1: Pure auction rules

**Files:**
- Create: `lib/auctionRules.mjs`
- Create: `tests/auction-rules.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `calculateUnsoldFee(reserve)`, `minimumNextBid(startingBid, currentBid)`, and `validateBidAmount(amount, minimum)`.

- [ ] Write failing Node tests for zero reserve, $100k minimum, nearest-$100k rounding, starting bid, next bid, and increment validation.
- [ ] Run `node --test tests/auction-rules.test.mjs`; expect module-not-found failure.
- [ ] Implement the three exported functions without dependencies.
- [ ] Add `"test": "node --test tests/*.test.mjs"` to `package.json`.
- [ ] Run `npm test`; expect all auction rule tests to pass.

### Task 2: Transactional lot schema and settlement

**Files:**
- Create: `supabase/migrations/138_auction_systems.sql`
- Modify: `database.types.ts` after schema verification if local generation is available.

**Interfaces:**
- Produces RPCs `create_auction_house_listing`, `publish_dutch_auctions`, `place_auction_bid`, `cancel_auction_listing`, `finish_auction`, and `resolve_expired_auctions`.
- Consumes existing `write_finance_entry`, `write_audit_log`, `league_players`, `contracts`, `team_upgrade_tickets`, and `notifications`.

- [ ] Add columns for mode, asset type, ticket id, creator, winning result, fee, cancellation, and draft status; add constraints ensuring exactly one supported asset is present.
- [ ] Add partial unique indexes preventing more than one active lot for the same league player or unused ticket.
- [ ] Implement `auction_unsold_fee(integer)` and verify it with SQL assertions matching Task 1.
- [ ] Implement manager listing validation: actor owns team and asset, league is `OFFSEASON`, deadline is future, amounts are valid, and ticket is unused.
- [ ] Implement host publication validation: actor is commissioner, every candidate is an unassigned league player, and every deadline is future.
- [ ] Implement atomic bidding: active/future lot, non-seller, league team, affordable amount, and valid $100k increment.
- [ ] Replace `finish_auction` with an idempotent transaction that moves a sold player or ticket, writes buyer/seller finances, charges the rounded fee when unsold, records outcome, notifications, and audit log.
- [ ] Implement expired-batch resolution restricted to the commissioner.
- [ ] Apply the migration to the configured development Supabase project and verify the RPC signatures.

### Task 3: Authenticated APIs

**Files:**
- Modify: `app/api/auctions/route.ts`
- Create: `app/api/auctions/assets/route.ts`
- Create: `app/api/auctions/listings/route.ts`
- Create: `app/api/league/auction-pool/route.ts`
- Create: `app/api/league/auctions/resolve/route.ts`

**Interfaces:**
- Produces JSON lots with public bid history, exact deadline, seller/source, current leader, minimum next bid, result, and viewer flags.
- Consumes Task 2 RPCs and Task 1 rules for response-only fee previews.

- [ ] Write route-level validation cases as pure rule tests before changing production handlers.
- [ ] Make GET settle expired lots best-effort, then return mode/status-scoped lots and current viewer context.
- [ ] Make POST call `place_auction_bid`; remove direct bid inserts and duplicated money checks.
- [ ] Add eligible-assets GET and Auction House listing/cancellation POST endpoints.
- [ ] Add host candidate query/generation and verified publication endpoints using rating, position, age, and quantity filters.
- [ ] Add host expired-resolution endpoint.
- [ ] Run `npm test` and `npx tsc --noEmit`; expect success.

### Task 4: Auction House manager UI

**Files:**
- Modify: `app/main/dashboard/auctions/page.tsx`
- Create: `components/auctions/AuctionLot.tsx`
- Create: `components/auctions/BidDialog.tsx`
- Create: `components/auctions/CreateListingDialog.tsx`

**Interfaces:**
- Consumes Task 3 lots, assets, listing, cancellation, and bid endpoints.
- Produces Dutch Auction and Auction House tabs with Active, Finished, My bids, and My listings filters.

- [ ] Add a failing component-data test for fee preview and minimum bid through Task 1 functions.
- [ ] Split repeated lot rendering from the existing page into `AuctionLot` while preserving current visual tokens.
- [ ] Add exact deadline, countdown, leader, public bid history, minimum bid, seller/source, and outcome copy.
- [ ] Add the listing flow for owned players and unused tickets with reserve/deadline review and unsold-fee confirmation.
- [ ] Disable ineligible assets with a reason; allow cancellation only before the first bid.
- [ ] Add loading skeletons, educational empty states, inline server errors, keyboard labels, and 44px mobile controls.
- [ ] Run `npm test` and `npx tsc --noEmit`; expect success.

### Task 5: Host pool controls

**Files:**
- Modify: `app/main/dashboard/host-controls/page.tsx`
- Create: `components/auctions/HostAuctionPoolCard.tsx`

**Interfaces:**
- Consumes Task 3 host candidate, publish, and resolve endpoints.
- Produces private generated proposals that cannot publish until reviewed and assigned deadlines.

- [ ] Add the Auction Pool card alongside other OFFSEASON controls.
- [ ] Add manual search and automatic filters for minimum/maximum rating, position, age, and quantity.
- [ ] Display generated players as a removable proposal with duplicate and already-assigned players disabled.
- [ ] Require an explicit host verification checkbox and future deadline for every lot before publication.
- [ ] Add “Resolve expired auctions” with resolved count feedback.
- [ ] Run `npm test` and `npx tsc --noEmit`; expect success.

### Task 6: Lock all competing asset actions

**Files:**
- Modify: `app/api/upgrade-ticket/route.ts`
- Modify player transfer/release routes discovered by `rg "league_players|contracts" app/api/trades app/api/transfer-list app/api/league`.
- Modify: `supabase/migrations/138_auction_systems.sql`

**Interfaces:**
- Consumes the active-lot partial indexes and an `asset_has_active_auction` database helper.

- [ ] Add failing rule tests for active player and ticket lock results.
- [ ] Enforce ticket lock inside `use_upgrade_ticket` so API bypasses cannot consume a listed ticket.
- [ ] Enforce player lock in the shared transfer/release execution path rather than only hiding UI actions.
- [ ] Verify cancelled, sold, and unsold lots release the lock naturally by leaving active status.
- [ ] Run `npm test` and `npx tsc --noEmit`; expect success.

### Task 7: Live UX and logic audit

**Files:**
- Modify only files required by reproducible findings, always after adding a failing regression test.
- Create: `docs/audits/2026-07-18-auctions-live-audit.md`

**Interfaces:**
- Produces a P0–P3 audit record and verified browser journeys.

- [ ] Start or reuse `npm run dev` on port 3001 and connect the in-app browser.
- [ ] As host, generate a filtered pool, reject/edit it, add a manual player, verify it, set real deadlines, publish it, and resolve an expired lot.
- [ ] As manager, place and raise public bids, test increment/budget/self-bid/late errors, and confirm bid history and leader updates.
- [ ] List a player and an unused ticket, verify the fee preview, test cancellation before/after bids, and confirm listed assets cannot be transferred or used.
- [ ] Exercise sold, reserve-not-met, and no-bid outcomes; confirm unsold assets remain with the seller and fees use the specified formula.
- [ ] Confirm a purchased ticket appears and can be used from Squad; confirm purchased players and finances update in Squad, Contracts, Transactions, and notifications.
- [ ] Test keyboard navigation, dialog focus/Escape, loading/empty/error states, and desktop/mobile viewport overflow.
- [ ] Fix reproducible P0/P1 auction defects through red-green tests; record remaining P2/P3 findings.
- [ ] Continue the broader audit with Free Agents, then the remaining transfer-season surfaces in the prior audit order.

### Task 8: Final verification

**Files:**
- Update: `docs/audits/2026-07-18-auctions-live-audit.md`

- [ ] Run `npm test`; expect all tests pass.
- [ ] Run `npx tsc --noEmit`; expect exit code 0.
- [ ] Run `npm run build`; expect production build success.
- [ ] Review `git diff --check`; expect no whitespace errors.
- [ ] Re-run the critical host, bidder, seller, sold, and unsold live journeys after the final build.
- [ ] Report verified outcomes, P0–P3 findings, files changed, and any external migration requirement.
