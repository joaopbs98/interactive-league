import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateUnsoldFee,
  minimumNextBid,
  validateBidAmount,
} from "../lib/auctionRules.mjs";

test("zero reserve has no unsold fee", () => {
  assert.equal(calculateUnsoldFee(0), 0);
});

test("unsold fee has a $100k minimum", () => {
  assert.equal(calculateUnsoldFee(1_000_000), 100_000);
});

test("unsold fee rounds 4% to nearest $100k", () => {
  assert.equal(calculateUnsoldFee(11_500_000), 500_000);
  assert.equal(calculateUnsoldFee(120_000_000), 4_800_000);
});

test("minimum bid starts at the listed starting bid", () => {
  assert.equal(minimumNextBid(2_000_000, null), 2_000_000);
});

test("minimum next bid is $100k above the leader", () => {
  assert.equal(minimumNextBid(2_000_000, 2_400_000), 2_500_000);
});

test("bid validation enforces minimum and $100k increments", () => {
  assert.deepEqual(validateBidAmount(2_500_000, 2_500_000), { valid: true });
  assert.equal(validateBidAmount(2_400_000, 2_500_000).valid, false);
  assert.equal(validateBidAmount(2_550_000, 2_500_000).valid, false);
});
