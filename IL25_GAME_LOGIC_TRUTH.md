# IL25 Game Logic – Basis of Truth

This document is the canonical reference for all game logic, formulas, and rules derived from the Excel sheets and IL25 spec. Use it as the source of truth when implementing features.

---

## 1. Free Agents

### 1.1 Points Value Formula

The team with the **highest Points Value** wins the player. All values must be in the same units (e.g. dollars).

**Formula (from Excel):**
```
Points Value = (ValueOfContract / 100000) * GuaranteedModifier * LengthMultiplier
```

**Components:**

| Variable | Formula | Description |
|----------|---------|-------------|
| `ValueOfContract` | `SeasonalSalary * Length` | Total contract value (H) |
| `GuaranteedModifier` | `1 + 0.2 * sign(G - 0.25) * abs(G - 0.25)^0.5 + (G < 0.2 ? -30.7 * (0.2 - G)^2 : 0)` | G = Guaranteed Pct. as decimal (0.25 = 25%) |
| `LengthMultiplier` | `CHOOSE(Length, 1, 0.98, 0.94, 0.88, 0.8)` | 1yr=1, 2yr=0.98, 3yr=0.94, 4yr=0.88, 5yr=0.8 |

**JavaScript/TypeScript implementation:**
```typescript
function freeAgentPointsValue(
  valueOfContract: number,  // H
  guaranteedPct: number,    // G as decimal (0.5 = 50%)
  lengthYears: number       // E as 1–5
): number {
  const base = valueOfContract / 100000;
  const g = guaranteedPct;
  let guaranteedMod = 1 + 0.2 * Math.sign(g - 0.25) * Math.pow(Math.abs(g - 0.25), 0.5);
  if (g < 0.2) guaranteedMod += -30.7 * Math.pow(0.2 - g, 2);
  const lengthMod = [1, 0.98, 0.94, 0.88, 0.8][Math.min(lengthYears - 1, 4)] ?? 0.8;
  return base * guaranteedMod * lengthMod;
}
```

### 1.2 Rules

- **Seasonal Salary:** $100,000 increments
- **Max contract length:** 2 years (from Excel "Max. 2" note for Length)
- **1-year contracts:** Always 100% guaranteed
- **100% in final season:** Guaranteed Pct. rule for last year of multi-year deals
- **Guaranteed $:** `ValueOfContract * GuaranteedPct`
- **Initial Cash Penalty:** Penalty on release/trade = remaining wages owed
- **No trade clause:** Adds a boost to the Points Value (exact formula TBD if not in Excel)
- **CLEAR button:** Host-only; clears all entries E6–H316, removes bold from D6–K316
- **First year:** No trade (permanent/loan) of free agent in first year after signing
- **Return to original club:** Free agency terms apply again if player returns during initial contract
- **Contract takeover:** Penalty waived if buying club takes over contract in full; penalty active again if that club later moves the player

---

## 2. Stadium

### 2.1 Performance Score Lookup

| Seasonal Performance | Score |
|----------------------|-------|
| UCL Winners | 10 |
| UCL Finalist | 9 |
| UCL Semi-Finalist | 8 |
| UCL Group Stage | 5 |
| UEL Winners | 7 |
| UEL Finalist | 6 |
| UEL Semi-Finalist | 5 |
| UEL Group Stage | 2 |
| UECL Winners | 4 |
| UECL Finalist | 3 |
| UECL Semi-Finalist | 2 |
| UECL Group Stage | 1 |

### 2.2 Attendance Formula

**Inputs:** `Capacity` (C), `Visitor Focus` (D), `Seasonal Performance` (F)

**Logic:**
- If `Seasonal Performance` is empty → return empty
- **Core Fanbase:** `MAX(36000, Capacity - (Capacity - 36000) * ((10 - perfScore) / 9))`
- **Local Casuals:** `Capacity * (0.4 + 0.05 * perfScore)`
- **Tourists:** `Capacity * (0.2 + 0.08 * perfScore)`
- **Hospitality & VIP:** `IF(perf = "UCL Winners", Capacity, Capacity * 0.08 * perfScore)`
- Default: 0

**JavaScript/TypeScript implementation:**
```typescript
const PERF_SCORE: Record<string, number> = {
  "UCL Winners": 10, "UCL Finalist": 9, "UCL Semi-Finalist": 8, "UCL Group Stage": 5,
  "UEL Winners": 7, "UEL Finalist": 6, "UEL Semi-Finalist": 5, "UEL Group Stage": 2,
  "UECL Winners": 4, "UECL Finalist": 3, "UECL Semi-Finalist": 2, "UECL Group Stage": 1
};

function stadiumAttendance(capacity: number, visitorFocus: string, seasonalPerformance: string): number {
  if (!seasonalPerformance) return 0;
  const p = PERF_SCORE[seasonalPerformance] ?? 0;
  switch (visitorFocus) {
    case "Core Fanbase":
      return Math.max(36000, capacity - (capacity - 36000) * ((10 - p) / 9));
    case "Local Casuals":
      return capacity * (0.4 + 0.05 * p);
    case "Tourists":
      return capacity * (0.2 + 0.08 * p);
    case "Hospitality & VIP":
      return seasonalPerformance === "UCL Winners" ? capacity : capacity * 0.08 * p;
    default:
      return 0;
  }
}
```

### 2.3 Revenue Formula

**Inputs:** `Visitor Focus` (D), `Attendance` (I), `Total games played` (H)

**Logic:** Revenue = `Attendance * pricePerTicket * (gamesPlayed / 2)`, rounded to nearest 100,000.

**Price per ticket by Visitor Focus:**
| Visitor Focus | Price | 
|---------------|-------|
| Core Fanbase | 66.86 |
| Local Casuals | 97.35 |
| Tourists | 101.35 |
| Hospitality & VIP | 130.02 |

**Formula:** `Revenue = ROUND(Attendance * pricePerTicket * (gamesPlayed / 2), -5)` (round to 100K)

**JavaScript/TypeScript implementation:**
```typescript
const PRICE_BY_FOCUS: Record<string, number> = {
  "Core Fanbase": 66.86,
  "Local Casuals": 97.35,
  "Tourists": 101.35,
  "Hospitality & VIP": 130.02
};

function stadiumRevenue(attendance: number, visitorFocus: string, totalGamesPlayed: number): number {
  const price = PRICE_BY_FOCUS[visitorFocus] ?? 0;
  const raw = attendance * price * (totalGamesPlayed / 2);
  return Math.round(raw / 100000) * 100000;
}
```

### 2.4 Stadium Rules

- **Visitor Focus:** Core Fanbase | Local Casuals | Tourists | Hospitality & VIP
- **Confirm V.F.:** Checkbox to lock selection; must be confirmed before season
- **Seasonal Performance:** Host enters after season (from dropdown)
- **SC Appearance:** Checkbox if Super Cup appearance applies
- **Matchday revenue:** Delayed by 1 year (current setup pays out next season)

---

## 3. Loans

### 3.1 Structure

- **Total interest:** 25% on top of principal
- **Example:** $60M loan → $75M total repayment ($60M + $15M interest)
- **Repayment schedule:** 3 installments (e.g. 25% each of total = $25M per installment, or as defined)
- **Available:** Seasons 2–7 only

### 3.2 Rules

- **Restructure:** No or 100%; requires Restr. Confirm checkbox
- **Early repayment:** Must have positive balance; cannot go into red when paying off early
- **Repay. Made:** Tracks number of repayments completed
- **Remaining:** Outstanding balance after repayments

---

## 4. Draft

### 4.1 Order

- **Draft order:** HOF & CompIndex (combined); penalty reductions disregarded
- **Top 3 picks:** RNG shuffle among the 3 worst teams (CompIndex + Performance), NBA-style

### 4.2 Selections

- **Specific player:** Manager picks a named player from the pool
- **Player of choice (80):** Manager picks any player from the pool with **up to 80 overall rating**
- **Merchandise Income %:** Fixed % (1, 2.5, 5, 10) added on top of team's merch_percentage
- **Upgrade Ticket:** Bronze (+1 OVR), Silver (+2), Gold (+3), Platinum (+4) when used on a player

### 4.3 Wage Discount

- **Drafted:** 20% wage discount (permanent)
- **On transfer:** Drops to 10% (discount applies to new team)

---

## 5. Auctions

- **Bid increment:** $100,000 minimum
- **Validation:** `amount % 100000 === 0` and `amount >= previousHighestBid + 100000`

---

## 6. Transfer List

- **Name / Looking For:** Specific player OR criteria (e.g. "81+ RB")
- **Rating:** Can show position variant (e.g. "80 (82 CAM)")
- **Price:** Cash OR "Trades or cash"

---

## 7. CompIndex

### 7.1 Best 14 Average

- CompIndex = average of **top 14 OVR** players only (not full squad)

### 7.2 Situation Thresholds

**By Best 14 Average:**
| Situation | Threshold |
|-----------|-----------|
| ABOVE AVERAGE | > 82.70 |
| ACCEPTABLE | 82.50 – 82.70 |
| CAUTION | 81.46 – 82.50 |
| CRITICAL | ≤ 81.46 |

**By HOF Last 3:**
| Situation | Threshold |
|-----------|-----------|
| EXCELLENT | ≥ 23 |
| OK | 11 – 23 |
| POOR | ≤ 11 |

---

## 8. Hall of Fame (HOF Points)

### 8.1 Competition-Based Points

HOF points come from **competition performance**, not league position:

| Competition | Stage | Points |
|-------------|-------|--------|
| UCL | Winners | 10 |
| UCL | Finalist | 9 |
| UCL | Semi-Finalist | 8 |
| UCL | Group Stage | 5 |
| UEL | Winners | 7 |
| UEL | Finalist | 6 |
| UEL | Semi-Finalist | 5 |
| UEL | Group Stage | 2 |
| UECL | Winners | 4 |
| UECL | Finalist | 3 |
| UECL | Semi-Finalist | 2 |
| UECL | Group Stage | 1 |

### 8.2 Metrics

- **HOF Overall:** Sum of all HOF points across seasons
- **HOF Last 3:** Sum of HOF points from last 3 seasons

---

## 9. Squad & Registration

- **Min squad:** 21
- **Max squad:** 23
- **Max goalkeepers:** 3
- **Validation:** At registration only (when transfer window closes)
- **During transfer window:** Squads can be <21 or >23

---

## 10. Bank and Balance

- **Start Bud:** Starting budget
- **Bud Rem:** Budget remaining
- **Wage Bill:** Sum of salaries with discounts applied
- **Merch %:** Merchandising percentage (30% base + draft bonuses)
- **Merch Rev:** Merchandising revenue (top 14 players, IR + position DEF/ATT)
- **Stock Price / Stock Change:** Team stock metrics

---

## 11. Merchandise Revenue

- **Base share:** 30% for all teams
- **Draft bonus:** merch_pct adds fixed % on top (1, 2.5, 5, 10)
- **Top 14 only:** Only the top 14 players by OVR contribute
- **IR values (1–5):** Fixed revenue per IR level
- **Position:** DEF (0.9×), ATT (1.2×), MID (1.0×)
- **Payout:** At end_season as "Merchandise" finance entry
- **Sell (lever):** Teams can sell draft merch % for immediate payout; 10% transaction cost

---

## 12. Youngsters

- **Upgrades:** From sheet (games played + adjusted avg). See [upgrade sheet](https://docs.google.com/spreadsheets/d/1sfdtZPyceXVmi2oSgAT-da9fqmXBwdx4d7eVRDY8XRA)
- **No wage bonuses:** Youngsters get base wage only
- **Individual training:** 3 focuses = 2.0 per OVR (vs 1.6)
- **Checkpoints:** 8 ratings above base → playstyle, Role+, IR+1; 12 → PlayStyle+ or Role++; max → weak foot +1, skill moves +1, IR+1

---

## 13. Moderator Rules (S2+)

Rules from moderator Discord posts (later overrides earlier).

### 13.1 Levers
- **Configurable:** `leagues.levers_enabled` — when false, sell-merch (Barcelona lever) is disabled
- **S2:** Levers scrapped (set `levers_enabled = false` for S2+ leagues)

### 13.2 Draft
- **Lottery top 3:** 3 worst teams by standings get picks 1–3 in random order; rest = inverse standings

### 13.3 Wage Discounts
- **Packed:** 20% at original club, 10% on transfer
- **Drafted:** 20% at original club, 10% on transfer
- **On transfer:** Both drop from 20% to 10%

### 13.4 Free Agency
- **Signing bonus:** Scrapped (S2+)
- **Guaranteed %:** Min 10% for multi-year; 1-year = always 100%
- **Penalty:** `Yrs.remaining × Salary × guaranteed_pct` on release/trade
- **No-trade clause:** +4% to Points Value when `no_trade_clause = true`
- **Contract takeover:** Buying club can take X% (10% increments); seller penalty reduced by `(1 - X)`

### 13.5 Contract Takeover
- **New contract:** `salary = original × X%`, `guaranteed_pct` preserved
- **Seller penalty:** `original_penalty × (1 - X)`

### 13.6 Loan Restructuring
- **Options:** 25%, 50%, 75%, 100% defer first repayment
- **Extra interest:** 2.5%, 5%, 7.5%, 10% based on defer %
- **Only allowed:** First season after loan, before any repayment

### 13.7 Stock Prices
- **Base:** $25, floor $12.50
- **HOF Rank:** ±30%
- **Wage Bill vs avg:** ±32.5%
- **Loan repayments:** +10% if low/none, -20% if high
- **Merch % vs avg:** ±7.5%
- **Merch Revenue:** +20% if 2× avg, -20% if 0.5× avg

### 13.8 Auction Reserve Fees
- **Sold:** No fee
- **Unsold:** 4% of reserve charged to listing team

---

## Changelog

| Date | Change |
|------|--------|
| 2025-02-24 | Initial creation from Excel formulas and IL25 spec |
| 2025-02-24 | Section 13: Moderator Rules (S2+) — levers, draft lottery, wage discounts, FA penalty, no-trade +4%, contract takeover, loan restructuring, stock prices, auction reserve fees |
