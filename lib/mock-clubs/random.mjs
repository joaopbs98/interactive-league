function hash32(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createDecisionSeed(parts) {
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new TypeError("Decision seed parts must be a non-empty array");
  }

  const framed = parts
    .map((part) => {
      const value = String(part);
      return `${value.length}:${value}`;
    })
    .join("|");

  return hash32(framed).toString(16).padStart(8, "0");
}

export function createSeededRandom(seed) {
  let state = hash32(String(seed)) || 0x6d2b79f5;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickSeeded(items, random) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new RangeError("Seeded selection requires a non-empty collection");
  }
  if (typeof random !== "function") {
    throw new TypeError("Seeded selection requires a random function");
  }

  return items[Math.floor(random() * items.length)];
}
