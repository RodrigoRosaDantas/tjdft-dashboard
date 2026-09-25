import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../supabase/functions/tjdft-notion/index.ts", import.meta.url), "utf8");
const declarations = [...source.matchAll(/^const\s+([A-Z][A-Z0-9_]*(?:PAGE_ID|DATA_SOURCE_ID))\s*=\s*["']([^"']+)["'];?$/gm)];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

assert.ok(declarations.length > 0, "Expected configured Notion page/data-source IDs.");
const malformed = declarations.filter(([, , id]) => !uuid.test(id));
assert.equal(malformed.length, 0, `Malformed Notion IDs: ${malformed.map(([, name, id]) => `${name}=${id}`).join(", ")}`);

const ids = new Map(declarations.map(([, name, id]) => [name, id]));
assert.equal(
  ids.get("SEQUENTIAL_MATERIALS_PAGE_ID"),
  "3d5cf5a2-6731-811a-af70-ea6e75d78dad",
  "Sequential materials must use the canonical TJDFT Notion page.",
);

assert.equal(
  ids.get("MATERIAL_CYCLE_PAGE_ID"),
  "3d6cf5a2-6731-817e-a2ac-d3fa05e87da4",
  "Cycle days must come from the canonical CTJ-002 D01-D14 material page.",
);

console.log(`Validated ${declarations.length} Notion page and data-source IDs.`);
