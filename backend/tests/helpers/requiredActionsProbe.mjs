/**
 * Probe for tests/requiredActions.test.mjs.
 *
 * Spawned by the test with `node --experimental-strip-types` so it can
 * import the real TypeScript sources. Receives cases as JSON in the
 * RA_CASES env var, evaluates them against src/lib/requiredActions.ts,
 * and prints the results as JSON.
 */
const cases = JSON.parse(process.env.RA_CASES ?? "[]");

const lib = await import("../../src/lib/requiredActions.ts");

const results = cases.map((c) => {
  switch (c.fn) {
    case "audienceMatches":
      return lib.audienceMatches(c.audience, c.opts);
    case "isLeaderRegistration":
      return lib.isLeaderRegistration(c.reg);
    case "completionPercent":
      return lib.completionPercent(c.completion);
    case "threshold":
      return lib.VIDEO_COMPLETION_THRESHOLD;
    default:
      throw new Error(`unknown fn: ${c.fn}`);
  }
});

console.log(JSON.stringify(results));
