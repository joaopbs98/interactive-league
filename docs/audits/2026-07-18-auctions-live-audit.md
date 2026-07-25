# Auctions live UX audit — 2026-07-18

League used: `Simulation Testing` (OFFSEASON). Testing was performed through the running app at `localhost:3001`, not only through SQL/API calls.

## Verified live

- Host Controls can generate a private pool from rating/position/count filters, let the host remove players, apply real-world deadlines, require explicit verification, and publish the reviewed pool.
- Dutch Auction lots appear publicly with player details, source, countdown, current bid, leader, and public bid history.
- Bids enforce the $100,000 increment. A $150,000 bid returned visible inline toast feedback; a valid $100,000 bid updated the leader to Gundam FC and the next bid to $200,000.
- Auction House lists eligible owned players and unused upgrade tickets. Sellers cannot bid on their own listing.
- The unsold fee preview matches the league formula: a $120M reserve displays $4.8M; a zero reserve displays $0.
- A no-bid listing can be cancelled and appears in Finished as `cancelled`; the player remains with the original club.
- Auctions are exposed only in OFFSEASON/transfer season paths.
- Upgrade tickets are real persisted assets. Bronze/Silver/Gold/Platinum apply +1/+2/+3/+4 OVR from Squad. Listed tickets are locked from use and transfer to the winner when sold.

## Findings fixed during the live pass

1. **P1 — Host pool generation silently returned no players.** User-scoped RLS hid unassigned players. Candidate lookup now uses the server service client after host authorization, and empty filters show a useful message.
2. **P1 — `datetime-local` values looked filled but did not update React state in the live browser.** Publish focused silently without making a request. Deadline controls now consume the input event, propagate the default deadline to every lot, and publish errors are caught and surfaced.
3. **P1 — Auction settlement RPC was callable by users outside the league after expiry.** Settlement now verifies commissioner/team membership before invoking the private implementation. A random outsider UUID was rejected live.
4. **P2 — Repeated bid/cancel controls had identical accessible names.** Buttons now name the amount and asset, enabling keyboard/screen-reader users to distinguish every lot.
5. **P2 — No-ticket state was ambiguous.** The listing dialog now explains when no unused upgrade tickets exist and where earned tickets can be used.
6. **P2 — Settlement had no direct participant notification.** Winners and sellers now receive an auction-finished notification without duplicating notifications on repeated resolution.

## Remaining test boundary

Completed with controlled Mock Team 1 seller fixtures and Gundam FC's real authenticated buyer UI:

- Bronze ticket was publicly identified by tier and description, bought for $100,000, transferred to Gundam FC, displayed in Squad, and applied to Axel Bamba. His league rating changed from 67 to 68 and the consumed ticket disappeared.
- Ticket eligibility is now derived from a roster snapshot captured when the previous season ends. A buyer can target only players they ended that season with and still own. A resale uses the buyer's own prior-season roster.
- Mason Munn sold for $100,000 and transferred to Gundam FC.
- Arda Usluoğlu received a $100,000 bid below a $1M reserve, remained with Mock Team 1, and charged the $100,000 minimum unsold fee.
- Isak Vanlalruatfela received no bids against a $120M reserve, remained with Mock Team 1, and charged the correctly rounded $4.8M fee.

The only unavailable scenario is two simultaneous authenticated human browser sessions. The buyer, settlement, ownership, finance, and ticket-use paths themselves were exercised live.

## Adjacent transfer-hub note carried forward

- Packs: the odds popover remains open during reveal, which competes with the reveal state (P3 polish issue).
- Trades: repeated generic `View` controls were ambiguous to assistive technology. Each action now identifies the source and destination teams. Existing trade details already resolve player names instead of exposing raw player IDs.

## Save-scoped player data follow-up

- The global `player` table is now treated as an immutable seed catalogue. Ratings, positions, potential, international reputation, detailed attributes, and custom metadata are stored as league-specific values in `league_players`.
- Custom compatibility rows are tagged with their source league and excluded from global packs, FA searches, draft searches, and other saves' player databases.
- Historical custom rows that had already appeared in multiple saves remain intact as independent league rows; no player or contract data was deleted.
- Live proof: Finlay Robertson's positions were changed in Simulation Testing while League Testing 9999 stayed unchanged, then the test value was restored. The player editor also now displays seed attributes for unset overrides instead of filling them with 50.
