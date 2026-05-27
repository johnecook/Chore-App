export type UserRole = "parent" | "child";

export type HouseholdRole = "admin" | "parent" | "child";

export interface HouseholdSettings {
  moneyFeaturesEnabled: boolean;
}

export type AssignmentMode = "selected_children" | "all_eligible_children" | "up_for_grabs";

export type ChoreValueModel = "fixed" | "allowance_included" | "unpaid";

export type ChoreScheduleType = "daily" | "weekly" | "interval" | "one_off";

export type ChoreInstanceStatus =
  | "available"
  | "assigned"
  | "submitted"
  | "approved"
  | "rejected"
  | "expired";

export type ApprovalEventType = "approved" | "rejected" | "reopened";

export type LedgerTransactionType =
  | "pending_credit"
  | "approved_credit"
  | "manual_adjustment"
  | "payout";

export type PayCycleType = "weekly" | "biweekly" | "monthly_date" | "monthly_weekday";

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ChoreRequirements {
  photoRequired: boolean;
  approvalRequired: boolean;
}

export interface ChoreValueSnapshot {
  valueModel: ChoreValueModel;
  amountCents: number;
}

export interface ChoreInstanceIdentity {
  templateId: string;
  assigneeId: string | null;
  occurrenceDate: string;
  dueWindowStart: string | null;
  dueWindowEnd: string | null;
  upForGrabsSlot: boolean;
}
