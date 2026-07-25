export const BID_INCREMENT = 100_000;

export function calculateUnsoldFee(reserve) {
  const value = Number(reserve) || 0;
  if (value <= 0) return 0;
  return Math.max(BID_INCREMENT, Math.round((value * 0.04) / BID_INCREMENT) * BID_INCREMENT);
}

export function minimumNextBid(startingBid, currentBid) {
  return currentBid == null
    ? Number(startingBid)
    : Number(currentBid) + BID_INCREMENT;
}

export function validateBidAmount(amount, minimum) {
  if (!Number.isFinite(amount) || amount < minimum) {
    return { valid: false, error: `Bid must be at least ${minimum}` };
  }
  if (amount % BID_INCREMENT !== 0) {
    return { valid: false, error: "Bid must be in $100,000 increments" };
  }
  return { valid: true };
}
