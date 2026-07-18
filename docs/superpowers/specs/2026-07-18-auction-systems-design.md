# Auction Systems Design

## Goal

Implement two public-bid auction modes that are available only while a league is in `OFFSEASON` (the transfer season), then verify their complete host and manager journeys in the live UI.

## Product model

### Dutch Auction

The league host publishes lots from a host-curated player pool. The host can add players manually or generate a proposed pool using filters such as rating range, position, age, and quantity. Generated players remain a private proposal until the host reviews and confirms them. The host must set a real-world deadline for every lot before publishing it.

All managers can see the current highest bid, leading team, and public bid history. Bids use $100,000 increments. Despite the conventional meaning of “Dutch auction,” the product retains the league’s established name for this ascending public-bid format.

### Auction House

Managers list assets they own:

- Players currently contracted to their team.
- Unused Bronze, Silver, Gold, or Platinum upgrade tickets.

The seller chooses a reserve and real-world deadline. The UI previews the unsold fee before publication:

`reserve = 0 ? 0 : max(100000, round(reserve * 0.04 / 100000) * 100000)`

If the highest bid meets the reserve, ownership transfers to the winner and the seller receives the winning amount. If the lot is unsold or the reserve is not met, the asset remains with or returns to the original team and the listing team pays the calculated fee.

## Shared lifecycle

Lots move through `draft`, `active`, and `finished` states. Host-generated Dutch lots remain drafts until verified. Auction House listings can be published immediately after server validation.

While active, an asset is locked: a player cannot be transferred, released, or placed in another auction, and a ticket cannot be used or relisted. A seller may cancel a listing only before its first bid. Finishing or valid cancellation releases the lock.

Only `OFFSEASON` leagues may create lots, publish lots, place bids, cancel eligible listings, or resolve lots. Reads remain available so finished history is still understandable after the transfer season ends.

The server rejects bids that are late, not in $100,000 increments, not at least $100,000 above the current high bid, from the listing team, or above the bidder’s current budget. Settlement revalidates the winner’s budget and asset ownership inside one database transaction.

Expired lots settle automatically when auction data is requested or a bid is attempted. Host Controls also provides a “Resolve expired auctions” action as an operational fallback. Settlement is idempotent.

## Data model

Extend the existing auction data into a generalized lot model rather than maintaining duplicated bidding engines.

Each lot records:

- League and mode: `dutch` or `auction_house`.
- Asset type: `player` or `upgrade_ticket`.
- Player or ticket identifier, with exactly one populated.
- Original/listing team when the lot comes from a manager.
- Starting bid, reserve, deadline, status, publisher, and timestamps.
- Settlement result, winning team, winning amount, and unsold fee.

Existing bids remain league-scoped through their auction and record team, amount, and timestamp. Database constraints and transactional RPCs enforce lifecycle rules instead of relying on UI state.

## Server boundaries

- Manager auction API: list owned eligible assets, create an Auction House listing, cancel an eligible listing.
- Host auction API: list candidate players, generate a filtered proposal, publish verified lots with deadlines, and resolve expired lots.
- Shared auction API: list active/finished lots, expose public bid history, and place bids.
- Settlement RPC: atomically finish a lot, move the asset when sold, write both finance entries, charge an unsold fee when applicable, release the asset lock, create notifications, and write an audit log.

## Interface

The Auctions page has two primary tabs: “Dutch Auction” and “Auction House.” Each mode provides Active, Finished, My bids, and (for Auction House) My listings views without hiding the current leader or bid history.

Active lots show the asset, seller/source, current bid, leading team, minimum next bid, exact deadline, countdown, and primary bid action. Finished lots explain sold/unsold outcome, winner, amount, reserve result, and fee when relevant.

Host Controls gains an Auction Pool section. The host can generate candidates with filters, remove or add candidates, review the proposal, assign deadlines, publish only valid lots, and resolve expired auctions. Publication errors identify the exact lot needing attention.

Manager listing uses a focused step flow: choose eligible asset, set reserve and deadline, review the unsold-fee warning, then publish. Assets already listed or otherwise unavailable are disabled with a reason.

## Tradable assets

Upgrade tickets are already persisted in `team_upgrade_tickets` and usable from Squad. A sold unused ticket changes `team_id`; it remains usable by the buyer through the same Squad workflow. Used tickets are never eligible.

Draft picks remain tradable through the existing trade system and are out of scope for this auction implementation. Merchandise percentage is currently applied directly to a team rather than stored as inventory, so it is not auctionable until it has a defined inventory and redemption model.

## Error handling and accessibility

All destructive or financial actions require clear confirmation. Server errors are shown next to the relevant control and through the established toast system. Dialogs have labels, descriptions, initial focus, Escape handling, and keyboard-reachable actions. Status never relies on colour alone. Mobile layouts avoid horizontal page overflow and preserve 44px touch targets.

## Testing and audit completion

Automated tests cover fee rounding and minimum, creation permissions, OFFSEASON enforcement, bid increments, self-bidding, asset locking, cancellation, sold player settlement, unsold player return, ticket transfer, expired resolution, and idempotency.

The live audit will exercise host pool generation/review/publication, public bidding and outbidding, Auction House player and ticket listings, invalid bids, cancellation restrictions, sold and unsold settlement, asset availability after settlement, finished history, keyboard use, empty/loading/error states, and narrow/mobile layouts. Findings will be prioritized P0–P3 and the audit will then continue beyond Auctions from the point where the prior task stopped.
