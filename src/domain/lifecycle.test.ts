import { describe, expect, it } from "vitest";
import {
  canCreatePayableCredit,
  canTransitionChore,
  requiresParentReopenForResubmission,
  statusAfterSubmission,
} from "./lifecycle";

describe("chore lifecycle", () => {
  it("allows approved chores, not submitted chores, to create payable credit", () => {
    expect(canCreatePayableCredit("submitted")).toBe(false);
    expect(canCreatePayableCredit("approved")).toBe(true);
  });

  it("routes submissions based on approval requirements", () => {
    expect(statusAfterSubmission({ approvalRequired: true, photoRequired: false })).toBe("submitted");
    expect(statusAfterSubmission({ approvalRequired: false, photoRequired: true })).toBe("approved");
  });

  it("allows parents to reopen expired chores", () => {
    expect(canTransitionChore("expired", "assigned")).toBe(true);
  });

  it("requires parent reopen for rejected chores after the due window", () => {
    expect(
      requiresParentReopenForResubmission({
        status: "rejected",
        dueWindowEnd: new Date("2026-06-01T22:00:00.000Z"),
        now: new Date("2026-06-02T12:00:00.000Z"),
      }),
    ).toBe(true);
  });
});
