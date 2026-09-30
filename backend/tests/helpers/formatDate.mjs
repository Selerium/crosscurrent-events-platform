/**
 * Loads the REAL `formatDate` helper out of src/controllers/events.ts.
 *
 * `formatDate` is a local const inside `registerForEvent`, so it cannot be
 * imported. Rather than copy-pasting it into the test (which would let the two
 * drift apart), we read the source file, slice out the declaration, strip the
 * TypeScript type annotations and evaluate the actual code under test.
 */
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const EVENTS_TS = path.resolve(here, "..", "..", "src", "controllers", "events.ts");

const DECLARATION = "const formatDate =";

/**
 * Slices the `formatDate` arrow function source out of events.ts.
 * Walks forward tracking bracket depth (and skipping string literals) until the
 * statement terminator at depth 0.
 */
export function extractFormatDateSource(eventsSource = readFileSync(EVENTS_TS, "utf8")) {
  const start = eventsSource.indexOf(DECLARATION);
  if (start === -1) {
    throw new Error(`Could not find "${DECLARATION}" in ${EVENTS_TS}`);
  }
  if (eventsSource.indexOf(DECLARATION, start + DECLARATION.length) !== -1) {
    throw new Error(`Found more than one "${DECLARATION}" in events.ts`);
  }

  const from = start + DECLARATION.length;
  let depth = 0;
  let quote = null;

  for (let i = from; i < eventsSource.length; i++) {
    const char = eventsSource[i];

    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "(" || char === "[" || char === "{") depth++;
    else if (char === ")" || char === "]" || char === "}") depth--;
    else if (char === ";" && depth === 0) {
      return eventsSource.slice(from, i).trim();
    }
  }

  throw new Error(`Unterminated "${DECLARATION}" declaration in events.ts`);
}

/**
 * Compiles the extracted `formatDate` and returns the callable.
 */
export function loadFormatDate(eventsSource) {
  const arrowSource = extractFormatDateSource(eventsSource);

  if (!arrowSource.includes("=>")) {
    throw new Error(`Extracted snippet is not an arrow function:\n${arrowSource}`);
  }

  // events.ts is TypeScript; erase the `(d: Date)` annotation so the real
  // source can be evaluated as plain JavaScript.
  const asJs = stripTypeScriptTypes(`${DECLARATION} ${arrowSource};`, { mode: "strip" });
  const body = asJs
    .slice(DECLARATION.length)
    .trim()
    .replace(/;$/, "");

  return new Function(`"use strict"; return (${body});`)();
}

/**
 * The implementation as it existed BEFORE the fix. Only used to prove the
 * tests actually detect the timezone bug instead of passing vacuously.
 */
export const legacyFormatDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
