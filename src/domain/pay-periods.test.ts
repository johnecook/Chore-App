import { describe, expect, it } from "vitest";
import { payPeriodForDate } from "./pay-periods";

describe("pay periods", () => {
  it("assigns approved earnings to the weekly period containing approval date", () => {
    expect(payPeriodForDate("2026-06-03", { type: "weekly", weekday: 5 })).toEqual({
      startDate: "2026-05-30",
      endDate: "2026-06-05",
      cycleType: "weekly",
    });
  });

  it("handles monthly dates that do not exist in shorter months", () => {
    expect(payPeriodForDate("2026-02-28", { type: "monthly_date", dayOfMonth: 31 })).toEqual({
      startDate: "2026-02-01",
      endDate: "2026-02-28",
      cycleType: "monthly_date",
    });
  });

  it("supports last weekday monthly cycles", () => {
    expect(payPeriodForDate("2026-05-29", { type: "monthly_weekday", ordinal: "last", weekday: 5 })).toEqual({
      startDate: "2026-04-25",
      endDate: "2026-05-29",
      cycleType: "monthly_weekday",
    });
  });
});
