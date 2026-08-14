import { describe, expect, it } from "vitest";
import { automaticUpdateCheckIntervalMs, delayUntilAutomaticUpdateCheck, recordUpdateCheckAttempt, resolveUpdateSchedule, shouldRunAutomaticUpdateCheck } from "./updateSchedule";

describe("Workshop update schedule", () => {
  const now = 1_800_000_000_000;

  it("uses a versioned, recoverable local record", () => {
    expect(resolveUpdateSchedule({ version: 1, lastAttemptAt: now, lastSuccessfulCheckAt: now })).toEqual({ version: 1, lastAttemptAt: now, lastSuccessfulCheckAt: now });
    expect(resolveUpdateSchedule({ version: 2, lastAttemptAt: now })).toBeNull();
    expect(resolveUpdateSchedule({ version: 1, lastAttemptAt: "now" })).toBeNull();
    expect(resolveUpdateSchedule(null)).toBeNull();
  });

  it("checks first launch and stale or future records, but throttles recent attempts", () => {
    expect(shouldRunAutomaticUpdateCheck(null, now)).toBe(true);
    expect(shouldRunAutomaticUpdateCheck({ version: 1, lastAttemptAt: now - automaticUpdateCheckIntervalMs, lastSuccessfulCheckAt: now - automaticUpdateCheckIntervalMs }, now)).toBe(true);
    expect(shouldRunAutomaticUpdateCheck({ version: 1, lastAttemptAt: now - automaticUpdateCheckIntervalMs + 1 }, now)).toBe(false);
    expect(shouldRunAutomaticUpdateCheck({ version: 1, lastAttemptAt: now + 1 }, now)).toBe(true);
  });

  it("calculates one bounded next check delay", () => {
    expect(delayUntilAutomaticUpdateCheck(null, now)).toBe(0);
    expect(delayUntilAutomaticUpdateCheck({ version: 1, lastAttemptAt: now - 1_000 }, now)).toBe(automaticUpdateCheckIntervalMs - 1_000);
  });

  it("records attempts without pretending an error was a successful check", () => {
    const previous = { version: 1 as const, lastAttemptAt: now - 1, lastSuccessfulCheckAt: now - 2 };
    expect(recordUpdateCheckAttempt(previous, now, false)).toEqual({ version: 1, lastAttemptAt: now, lastSuccessfulCheckAt: now - 2 });
    expect(recordUpdateCheckAttempt(previous, now, true)).toEqual({ version: 1, lastAttemptAt: now, lastSuccessfulCheckAt: now });
  });
});
