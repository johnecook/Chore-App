import { describe, expect, it } from "vitest";
import {
  choreTemplateCommandErrorMessage,
  createChoreTemplateFormSchema,
  validationErrorMessage,
} from "./form-validation";

const validChore: Record<string, unknown> = {
  title: "Unload dishwasher",
  description: "Put everything away.",
  scheduleType: "daily",
  startDate: "2026-06-22",
  weeklyWeekdays: [],
  intervalDays: undefined,
  oneOffDate: undefined,
  dueTimeStart: "08:00",
  dueTimeEnd: "09:00",
  assignmentMode: "selected_children",
  rotationCadence: undefined,
  rotationChildScope: undefined,
  rotationStartChildProfileId: undefined,
  valueModel: "unpaid",
  amountDollars: undefined,
  selectedChildProfileIds: ["00000000-0000-4000-8000-000000000001"],
  checklistItems: [],
  photoRequired: false,
  approvalRequired: true,
};

function messageFor(overrides: Partial<typeof validChore>) {
  const parsed = createChoreTemplateFormSchema.safeParse({
    ...validChore,
    ...overrides,
  });

  if (parsed.success) {
    throw new Error("Expected validation to fail.");
  }

  return validationErrorMessage(parsed.error);
}

describe("chore template form validation", () => {
  it("returns helpful messages for core required fields", () => {
    expect(messageFor({ title: "" })).toBe("Enter a chore title.");
    expect(messageFor({ startDate: "tomorrow" })).toBe("Choose a valid start date.");
    expect(messageFor({ scheduleType: "weekly", weeklyWeekdays: [] })).toBe("Choose at least one weekday.");
    expect(messageFor({ assignmentMode: "selected_children", selectedChildProfileIds: [] })).toBe(
      "Choose at least one child.",
    );
  });

  it("returns helpful messages for schedule and value edge cases", () => {
    expect(messageFor({ scheduleType: "interval", intervalDays: undefined })).toBe("Enter an interval.");
    expect(messageFor({ scheduleType: "one_off", oneOffDate: "2026-06-21" })).toBe(
      "Choose a chore date on or after the start date.",
    );
    expect(messageFor({ dueTimeStart: "11:00", dueTimeEnd: "10:00" })).toBe(
      "Due window end must be after the start.",
    );
    expect(messageFor({ valueModel: "fixed", amountDollars: 0 })).toBe(
      "Enter an amount for fixed-value chores.",
    );
  });

  it("returns field-specific messages instead of generic parser text", () => {
    expect(messageFor({ scheduleType: "sometimes" })).toBe("Choose a valid schedule type.");
    expect(messageFor({ weeklyWeekdays: ["9"] })).toBe("Choose valid weekdays.");
    expect(messageFor({ intervalDays: "soon" })).toBe("Enter a valid interval.");
    expect(messageFor({ oneOffDate: "next week" })).toBe("Choose a valid chore date.");
    expect(messageFor({ dueTimeStart: "morning" })).toBe("Enter a valid due-after time.");
    expect(messageFor({ dueTimeEnd: "night" })).toBe("Enter a valid due-before time.");
    expect(messageFor({ assignmentMode: "oldest_child" })).toBe("Choose how this chore is assigned.");
    expect(messageFor({ rotationCadence: "sometimes" })).toBe("Choose how often this chore rotates.");
    expect(messageFor({ rotationChildScope: "some_children" })).toBe(
      "Choose which children are in this rotation.",
    );
    expect(messageFor({ rotationStartChildProfileId: "not-a-child-id" })).toBe(
      "Choose a valid child to start the rotation.",
    );
    expect(messageFor({ valueModel: "gold_stars" })).toBe("Choose a valid value type.");
    expect(messageFor({ amountDollars: "a lot" })).toBe("Enter a valid chore amount.");
    expect(messageFor({ selectedChildProfileIds: ["not-a-child-id"] })).toBe("Choose a valid child.");
    expect(messageFor({ photoRequired: "yes" })).toBe("Choose whether photo proof is required.");
    expect(messageFor({ approvalRequired: "yes" })).toBe("Choose whether parent approval is required.");
  });

  it("accepts saved Supabase time values with seconds", () => {
    const parsed = createChoreTemplateFormSchema.safeParse({
      ...validChore,
      dueTimeStart: "08:00:00",
      dueTimeEnd: "09:30:00",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.dueTimeStart).toBe("08:00");
      expect(parsed.data.dueTimeEnd).toBe("09:30");
    }
  });

  it("maps database constraint errors to form-friendly messages", () => {
    expect(choreTemplateCommandErrorMessage(new Error("violates chore_templates_due_time_order"), "fallback")).toBe(
      "Due window end must be after the start.",
    );
    expect(choreTemplateCommandErrorMessage(new Error("new row violates row-level security policy"), "fallback")).toBe(
      "You do not have permission to save chores for this household.",
    );
  });
});
