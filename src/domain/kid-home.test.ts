import { describe, expect, it } from "vitest";
import { buildDateGroupedSections } from "./kid-home";

describe("buildDateGroupedSections", () => {
  it("groups only current items into Today", () => {
    const sections = buildDateGroupedSections(
      [
        { id: "overdue", occurrence_date: "2026-05-26" },
        { id: "today", occurrence_date: "2026-05-27" },
      ],
      "2026-05-27",
    );

    expect(sections[0].items.map((item) => item.id)).toEqual(["today"]);
  });

  it("groups items due before Sunday into This week", () => {
    const sections = buildDateGroupedSections(
      [
        { id: "tomorrow", occurrence_date: "2026-05-28" },
        { id: "sunday", occurrence_date: "2026-05-31" },
        { id: "next-monday", occurrence_date: "2026-06-01" },
      ],
      "2026-05-27",
    );

    expect(sections[1].items.map((item) => item.id)).toEqual(["tomorrow", "sunday"]);
  });

  it("groups later items into Whenever", () => {
    const sections = buildDateGroupedSections(
      [{ id: "later", occurrence_date: "2026-06-01" }],
      "2026-05-27",
    );

    expect(sections[2].items.map((item) => item.id)).toEqual(["later"]);
  });

  it("excludes daily recurring items from This week", () => {
    const sections = buildDateGroupedSections(
      [
        { id: "daily", occurrence_date: "2026-05-28", scheduleType: "daily" },
        { id: "weekly", occurrence_date: "2026-05-28", scheduleType: "weekly" },
      ],
      "2026-05-27",
      (item) => item.scheduleType === "daily",
    );

    expect(sections[1].items.map((item) => item.id)).toEqual(["weekly"]);
  });

  it("can exclude weekday-recurring weekly items from This week", () => {
    const sections = buildDateGroupedSections(
      [
        { id: "weekday-recurring", occurrence_date: "2026-05-28", weeklyWeekdays: [1, 2, 3, 4, 5] },
        { id: "once-weekly", occurrence_date: "2026-05-28", weeklyWeekdays: [4] },
      ],
      "2026-05-27",
      (item) => item.weeklyWeekdays.length > 1,
    );

    expect(sections[1].items.map((item) => item.id)).toEqual(["once-weekly"]);
  });
});
