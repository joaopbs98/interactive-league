# Gap Audit vs final_doc.md (IL25 Full Spec)

> **Source of truth:** `final_doc.md` — all findings reference sections from that document.

---

## 1) Player Acquisition Methods (Section 6, 8)

Per spec, users can get players via:

| Method | Spec Section | Current Status | Notes |
|--------|--------------|----------------|-------|
| **Starter squad** | 6.1 createLeague, joinLeague | ✅ Implemented | 18 players OVR 50-60 via `auto_starter_squad` |
| **Draft** | 6.4, 8.1 | ✅ Implemented | start_draft + make_draft_pick; draft page wired to API |
| **Free Agents** | 6.5, 8.2 | ⚠️ Simplified | Direct sign implemented; spec wants `placeBid` + `resolveFreeAgency` (host) |
| **Auctions** | 4.11, sidebar | ⚠️ Partial | Auctions table exists (no league_id); API has phase lock + roster cap; different model (live timer vs spec sealed bids) |
| **Trades** | 6.6, 8.3 | ✅ Implemented | propose/accept flow exists |
| **Packs** | 6.3, 8.4 | ✅ Implemented | openPack with phase lock, roster cap |

---

## 2) Phase Locks (Section 3.3, 8)

**Rule:** No roster moves during `IN_SEASON`. All of: Draft, Auctions, FA, Trades, Packs = OFFSEASON only.

| Action | Server Check | Location |
|--------|--------------|----------|
| Packs | ✅ `IN_SEASON` blocks | `app/api/packs/route.ts` |
| Trades | ✅ `IN_SEASON` blocks | `app/api/trades/route.ts` |
| Free Agents | ✅ `IN_SEASON` blocks | `app/api/freeagents/route.ts` |
| Auctions | ✅ IN_SEASON blocks | `app/api/auctions/route.ts` |
| Draft | ✅ IN_SEASON blocks (via make_draft_pick) | `app/api/draft/route.ts` |

---

## 3) Roster Cap (Section 3.1)

**Rule:** Max 25 players. Block if action would exceed 25.

| Action | Enforced | Location |
|--------|----------|----------|
| Pack open | ✅ (block if >22 for 3-player pack) | `app/api/packs/route.ts` |
| Free agent sign | ✅ | `app/api/freeagents/route.ts` |
| Trade accept | ❓ Needs verification | `app/api/trades/` |
| Draft pick | ✅ Roster cap | `make_draft_pick` in 044 |
| Auction bid | ✅ Roster cap on bid | `app/api/auctions/route.ts` |

---

## 4) endSeason Completeness (Section 6.8, Flow Phase D)

**Required steps (all mandatory):**

| Step | Required | Implemented | Location |
|------|----------|-------------|----------|
| 1. All matches simulated | ✅ | ✅ | `end_season` in 036 |
| 2. Final standings | ✅ | ✅ | Standings maintained by simulateMatchday |
| 3. Prize money | ✅ | ✅ | `write_finance_entry` loop |
| 4. Sponsor bonuses/penalties | ✅ | ✅ | Migration 043 |
| 5. Trade objectives | ✅ | ✅ | Migration 043 |
| 6. Contract decrement | ✅ | ✅ | `UPDATE contracts SET years = years - 1` |
| 7. Expire contracts → free agents | ✅ | ✅ | `UPDATE league_players SET team_id = NULL` |
| 8. Wage payment | ✅ | ✅ | `write_finance_entry` per team |
| 9. CompIndex/Stock | ✅ | ✅ | `UPDATE teams SET comp_index = ...` |
| 10. Draft pool | ✅ | ✅ | Free agents = draft pool; host starts draft via start_draft |
| 11. status = OFFSEASON | ✅ | ✅ | `UPDATE leagues SET status = 'OFFSEASON'` |
| 12. Audit log | ✅ | ✅ | `write_audit_log` |

---

## 5) Missing / Incomplete

### Screens (Section 5)
- **Draft**: ✅ Real API + page (044, /api/draft)
- **Auctions**: League-scoped (042); API has phase lock, roster cap, league filter
- **Loans**: Page exists; verify backend
- **Sponsors**: Page exists; verify objectives + bonuses
- **Audit Logs viewer**: Host controls show audit logs; verify full viewer

### Server Functions (Section 6)
- `startDraft(league_id)` — ✅ Migration 044
- `makeDraftPick(draft_pick_id, selected_player_id)` — ✅ Migration 044
- `placeBid(player_id, bonus, salary, years)` — current FA uses direct sign, not bids
- `resolveFreeAgency(league_id)` — missing (host-triggered bid resolution)
- `generateSchedule` — exists in game API
- `simulateMatchday` — exists
- `endSeason` — exists; sponsor + objectives are placeholders

### Wage Feasibility (Section 3.2)
- Spec: block if total salaries would exceed available budget
- Current: ✅ enforced on FA sign; ❓ trade, auction win

---

## 6) Recommended Fix Order

1. **Correct documentation** — Migration 041 comment (done)
2. **Draft** — Implement `startDraft`, `makeDraftPick`, draft pool from `endSeason` or host action
3. **Free Agents vs Auctions** — Align with spec: either sealed bids (`placeBid` + `resolveFreeAgency`) or keep direct sign and document as simplified
4. **Sponsor + Trade objectives** — Implement in `endSeason`
5. **Roster cap on trades** — Verify both teams ≤25 after trade
6. **Wage feasibility** — Add check before FA sign, trade, auction win

---

## 7) Auctions Table: league_id added

- Migration 042 adds `league_id` to auctions
- GET/POST filter by leagueId when provided

---

## 8) Contracts Table Mismatch

Spec (4.4): `salary_year`, `years_remaining`, `signing_bonus`, `guaranteed`  
Current schema: `wage`, `years`, `signing_bonus` — column names differ but behavior similar. Verify `contracts` matches usage in endSeason (e.g. `years` vs `years_remaining`).
