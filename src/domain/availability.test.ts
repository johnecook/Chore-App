import { describe, expect, it } from "vitest";
import { isChildAvailableForHousehold } from "./availability";

const basePattern = {
  householdId: "dad-household",
  anchorDate: "2026-06-01",
  cycleLengthDays: 14,
  availableDayOffsets: [0, 1, 2, 3, 4, 5, 6],
};

describe("custody availability", () => {
  it("uses the repeating base pattern", () => {
    expect(
      isChildAvailableForHousehold({
        date: "2026-06-03",
        householdId: "dad-household",
        basePattern,
      }),
    ).toBe(true);

    expect(
      isChildAvailableForHousehold({
        date: "2026-06-10",
        householdId: "dad-household",
        basePattern,
      }),
    ).toBe(false);
  });

  it("lets date-specific overrides replace the base pattern", () => {
    expect(
      isChildAvailableForHousehold({
        date: "2026-06-10",
        householdId: "dad-household",
        basePattern,
        overrides: [{ date: "2026-06-10", householdId: "dad-household", available: true }],
      }),
    ).toBe(true);
  });
});
