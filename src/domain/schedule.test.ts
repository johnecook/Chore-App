import { describe, expect, it } from "vitest";
import { generateChoreInstanceIdentities, instanceIdentityKey } from "./schedule";

describe("schedule generation", () => {
  it("creates separate child-specific instances for assigned children", () => {
    const instances = generateChoreInstanceIdentities({
      template: {
        templateId: "template-1",
        earningHouseholdId: "dad-household",
        scheduleType: "daily",
        assignmentMode: "selected_children",
        assigneeIds: ["will", "ben"],
        startDate: "2026-06-01",
        dueTimeEnd: "20:00:00",
      },
      rangeStart: "2026-06-01",
      rangeEnd: "2026-06-01",
      availabilityByChildId: {
        will: {
          householdId: "dad-household",
          anchorDate: "2026-06-01",
          cycleLengthDays: 7,
          availableDayOffsets: [0],
        },
        ben: {
          householdId: "dad-household",
          anchorDate: "2026-06-01",
          cycleLengthDays: 7,
          availableDayOffsets: [0],
        },
      },
    });

    expect(instances.map((instance) => instance.assigneeId)).toEqual(["will", "ben"]);
  });

  it("creates one claimable instance for up-for-grabs chores", () => {
    const instances = generateChoreInstanceIdentities({
      template: {
        templateId: "template-2",
        earningHouseholdId: "dad-household",
        scheduleType: "daily",
        assignmentMode: "up_for_grabs",
        assigneeIds: ["will", "ben"],
        startDate: "2026-06-01",
      },
      rangeStart: "2026-06-01",
      rangeEnd: "2026-06-01",
      availabilityByChildId: {},
    });

    expect(instances).toHaveLength(1);
    expect(instances[0]?.assigneeId).toBeNull();
    expect(instances[0]?.upForGrabsSlot).toBe(true);
  });

  it("produces stable idempotency keys", () => {
    const [instance] = generateChoreInstanceIdentities({
      template: {
        templateId: "template-3",
        earningHouseholdId: "dad-household",
        scheduleType: "one_off",
        assignmentMode: "selected_children",
        assigneeIds: ["will"],
        startDate: "2026-06-01",
        oneOffDate: "2026-06-05",
        dueTimeStart: "17:00:00",
        dueTimeEnd: "20:00:00",
      },
      rangeStart: "2026-06-01",
      rangeEnd: "2026-06-30",
      availabilityByChildId: {
        will: {
          householdId: "dad-household",
          anchorDate: "2026-06-01",
          cycleLengthDays: 7,
          availableDayOffsets: [4],
        },
      },
    });

    expect(instanceIdentityKey(instance)).toBe(
      "template-3:will:2026-06-05:2026-06-05T17:00:00:2026-06-05T20:00:00",
    );
  });
});
