import type { ChoreInstanceStatus, ChoreRequirements } from "./types";

const allowedTransitions: Record<ChoreInstanceStatus, ChoreInstanceStatus[]> = {
  available: ["assigned", "expired"],
  assigned: ["submitted", "expired"],
  submitted: ["approved", "rejected"],
  approved: [],
  rejected: ["submitted", "expired"],
  expired: ["assigned"],
};

export function canTransitionChore(
  from: ChoreInstanceStatus,
  to: ChoreInstanceStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertChoreTransition(
  from: ChoreInstanceStatus,
  to: ChoreInstanceStatus,
): void {
  if (!canTransitionChore(from, to)) {
    throw new Error(`Cannot transition chore from ${from} to ${to}.`);
  }
}

export function statusAfterSubmission(requirements: ChoreRequirements): ChoreInstanceStatus {
  return requirements.approvalRequired ? "submitted" : "approved";
}

export function canCreatePayableCredit(status: ChoreInstanceStatus): boolean {
  return status === "approved";
}

export function requiresParentReopenForResubmission(params: {
  status: ChoreInstanceStatus;
  dueWindowEnd: Date;
  now: Date;
}): boolean {
  return params.status === "rejected" && params.now.getTime() > params.dueWindowEnd.getTime();
}
