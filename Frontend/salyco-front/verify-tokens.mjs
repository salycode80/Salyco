/**
 * Asserts that public/tokens.css and src/index.css agree.
 *
 * These two files are a mapping, not a source of truth and a copy: tokens.css
 * declares --salyco-x and index.css maps --color-x onto it. A token added to one
 * and not the other is invisible in review and half-repaints the site — the
 * React pages keep the old colour while the article pages take the new one.
 *
 * Safe to delete once this stops being useful.
 *
 * Run from Frontend/salyco-front/:  node verify-tokens.mjs
 */
import { readFileSync } from "node:fs";

const tokens = readFileSync("public/tokens.css", "utf8");
const theme = readFileSync("src/index.css", "utf8");

const declared = new Set(
  [...tokens.matchAll(/--salyco-([a-z0-9-]+)\s*:/g)].map((m) => m[1]),
);

const mapped = [...theme.matchAll(/--(?:color|font)-([a-z0-9-]+)\s*:\s*var\(--salyco-([a-z0-9-]+)\)/g)]
  .map((m) => m[2]);

const failures = [];

for (const name of mapped) {
  if (!declared.has(name)) {
    failures.push(`index.css maps --salyco-${name}, which tokens.css never declares`);
  }
}

for (const name of declared) {
  if (!mapped.includes(name) && !name.startsWith("font-")) {
    failures.push(`tokens.css declares --salyco-${name}, which index.css never maps`);
  }
}

/* A palette nothing links is a palette that does not exist, and the symptom is
   every colour on the site going transparent at once. The article pages link
   this file from Backend/articles/templates/articles/base_article.html; this is
   the React half. */
const html = readFileSync("index.html", "utf8");
if (!/href="\/tokens\.css"/.test(html)) {
  failures.push(`index.html does not link /tokens.css, so the React app has no palette`);
}

if (failures.length) {
  console.error("Token drift:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}

console.log(`OK — ${declared.size} tokens declared, ${mapped.length} mapped.`);
