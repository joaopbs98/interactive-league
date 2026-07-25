import test from "node:test";
import assert from "node:assert/strict";

import {
  isAllowedImageProxyUrl,
  isDebugWriteAllowed,
} from "../lib/security/productionGates.mjs";

test("image proxy accepts only HTTPS images from approved hosts", () => {
  assert.equal(
    isAllowedImageProxyUrl("https://cdn.sofifa.net/players/001/001/25_120.png"),
    true,
  );
  assert.equal(
    isAllowedImageProxyUrl(
      "https://example-project.supabase.co/storage/v1/object/public/badges/a.png",
    ),
    true,
  );
  assert.equal(isAllowedImageProxyUrl("http://cdn.sofifa.net/player.png"), false);
  assert.equal(isAllowedImageProxyUrl("https://example.com/player.png"), false);
  assert.equal(isAllowedImageProxyUrl("http://127.0.0.1:3000/admin"), false);
  assert.equal(isAllowedImageProxyUrl("not-a-url"), false);
});

test("debug writes are disabled in production", () => {
  assert.equal(isDebugWriteAllowed("production"), false);
  assert.equal(isDebugWriteAllowed("development"), true);
  assert.equal(isDebugWriteAllowed("test"), true);
});
