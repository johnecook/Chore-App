import { describe, expect, it } from "vitest";
import { buildDateGroupedSections } from "./kid-home";

describe("buildDateGroupedSections", () => {
  it("groups overdue and current items into Today", () => {
    const sections = buildDateGroupedSections(
      [
        { id: "overdue", occurrence_date: "2026-05-26" },
        { id: "today", occurrence_date: "2026-05-27" },
      ],
      "2026-05-27",
    );

    expect(sections[0].items.map((item) => item.id)).toEqual(["overdue", "today"]);
  });

  it("groups items due within seven days into This week", () => {
    const sections = buildDateGroupedSections(
      [
        { id: "tomorrow", occurrence_date: "2026-05-28" },
        { id: "week-end", occurrence_date: "2026-06-03" },
      ],
      "2026-05-27",
    );

    expect(sections[1].items.map((item) => item.id)).toEqual(["tomorrow", "week-end"]);
  });

  it("groups later items into Whenever", () => {
    const sections = buildDateGroupedSections(
      [{ id: "later", occurrence_date: "2026-06-04" }],
      "2026-05-27",
    );

    expect(sections[2].items.map((item) => item.id)).toEqual(["later"]);
  });
});
