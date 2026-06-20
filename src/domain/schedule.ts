import { isChildAvailableForHousehold, type AvailabilityOverride, type RepeatingAvailabilityPattern } from "./availability";
import type {
  AssignmentMode,
  ChoreInstanceIdentity,
  ChoreScheduleType,
  RotationCadence,
  RotationChildScope,
  Weekday,
} from "./types";

export type ChoreTemplateSchedule = {
  templateId: string;
  earningHouseholdId: string;
  scheduleType: ChoreScheduleType;
  assignmentMode: AssignmentMode;
  assigneeIds: string[];
  rotationCadence?: RotationCadence;
  rotationChildScope?: RotationChildScope;
  rotationAnchorDate?: string;
  startDate: string;
  endDate?: string;
  weeklyWeekdays?: Weekday[];
  intervalDays?: number;
  oneOffDate?: string;
  dueTimeStart?: string;
  dueTimeEnd?: string;
};

export type GenerateInstancesInput = {
  template: ChoreTemplateSchedule;
  rangeStart: string;
  rangeEnd: string;
  availabilityByChildId: Record<string, RepeatingAvailabilityPattern>;
  availabilityOverridesByChildId?: Record<string, AvailabilityOverride[]>;
};

export function instanceIdentityKey(identity: ChoreInstanceIdentity): string {
  return [
    identity.templateId,
    identity.assigneeId ?? "up_for_grabs",
    identity.occurrenceDate,
    identity.dueWindowStart ?? "no_start",
    identity.dueWindowEnd ?? "no_end",
  ].join(":");
}

export function generateChoreInstanceIdentities(input: GenerateInstancesInput): ChoreInstanceIdentity[] {
  const dates = occurrenceDates(input.template, input.rangeStart, input.rangeEnd);
  const identities: ChoreInstanceIdentity[] = [];

  for (const occurrenceDate of dates) {
    if (input.template.assignmentMode === "up_for_grabs") {
      identities.push(buildIdentity(input.template, occurrenceDate, null, true));
      continue;
    }

    if (input.template.assignmentMode === "rotation") {
      const assigneeId = resolveRotatingAssignee(input, occurrenceDate);
      if (assigneeId) {
        identities.push(buildIdentity(input.template, occurrenceDate, assigneeId, false));
      }
      continue;
    }

    for (const childId of input.template.assigneeIds) {
      const basePattern = input.availabilityByChildId[childId];
      if (!basePattern) {
        continue;
      }

      const isAvailable = isChildAvailableForHousehold({
        date: occurrenceDate,
        householdId: input.template.earningHouseholdId,
        basePattern,
        overrides: input.availabilityOverridesByChildId?.[childId],
      });

      if (isAvailable) {
        identities.push(buildIdentity(input.template, occurrenceDate, childId, false));
      }
    }
  }

  return dedupeByKey(identities);
}

function resolveRotatingAssignee(input: GenerateInstancesInput, occurrenceDate: string): string | null {
  if (!input.template.assigneeIds.length || !input.template.rotationCadence) {
    return null;
  }

  const anchorDate = input.template.rotationAnchorDate ?? input.template.startDate;
  const rotationIndex = rotationPeriodIndex(input.template.rotationCadence, anchorDate, occurrenceDate);
  const startIndex = positiveModulo(rotationIndex, input.template.assigneeIds.length);

  for (let offset = 0; offset < input.template.assigneeIds.length; offset += 1) {
    const childId = input.template.assigneeIds[(startIndex + offset) % input.template.assigneeIds.length];
    if (!childId) {
      continue;
    }

    const basePattern = input.availabilityByChildId[childId];
    if (!basePattern) {
      continue;
    }

    const isAvailable = isChildAvailableForHousehold({
      date: occurrenceDate,
      householdId: input.template.earningHouseholdId,
      basePattern,
      overrides: input.availabilityOverridesByChildId?.[childId],
    });

    if (isAvailable) {
      return childId;
    }
  }

  return null;
}

function rotationPeriodIndex(cadence: RotationCadence, anchorDate: string, occurrenceDate: string) {
  if (cadence === "daily") {
    return daysBetween(anchorDate, occurrenceDate);
  }

  if (cadence === "weekly") {
    return Math.floor(daysBetween(anchorDate, occurrenceDate) / 7);
  }

  const anchor = new Date(`${anchorDate}T00:00:00.000Z`);
  const occurrence = new Date(`${occurrenceDate}T00:00:00.000Z`);
  return (occurrence.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + occurrence.getUTCMonth() - anchor.getUTCMonth();
}

function daysBetween(startDate: string, endDate: string) {
  return (Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) / 86_400_000;
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function occurrenceDates(template: ChoreTemplateSchedule, rangeStart: string, rangeEnd: string): string[] {
  const first = maxIsoDate(template.startDate, rangeStart);
  const last = minIsoDate(template.endDate ?? rangeEnd, rangeEnd);
  const dates: string[] = [];

  if (template.scheduleType === "one_off") {
    const oneOffDate = template.oneOffDate ?? template.startDate;
    return oneOffDate >= first && oneOffDate <= last ? [oneOffDate] : [];
  }

  for (let cursor = first; cursor <= last; cursor = addDays(cursor, 1)) {
    if (template.scheduleType === "daily") {
      dates.push(cursor);
    }

    if (
      template.scheduleType === "weekly" &&
      template.weeklyWeekdays?.includes(new Date(`${cursor}T00:00:00.000Z`).getUTCDay() as Weekday)
    ) {
      dates.push(cursor);
    }

    if (template.scheduleType === "interval") {
      const intervalDays = template.intervalDays ?? 1;
      const daysFromStart =
        (Date.parse(`${cursor}T00:00:00.000Z`) - Date.parse(`${template.startDate}T00:00:00.000Z`)) /
        86_400_000;
      if (daysFromStart >= 0 && daysFromStart % intervalDays === 0) {
        dates.push(cursor);
      }
    }
  }

  return dates;
}

function buildIdentity(
  template: ChoreTemplateSchedule,
  occurrenceDate: string,
  assigneeId: string | null,
  upForGrabsSlot: boolean,
): ChoreInstanceIdentity {
  return {
    templateId: template.templateId,
    assigneeId,
    occurrenceDate,
    dueWindowStart: template.dueTimeStart ? `${occurrenceDate}T${template.dueTimeStart}` : null,
    dueWindowEnd: template.dueTimeEnd ? `${occurrenceDate}T${template.dueTimeEnd}` : null,
    upForGrabsSlot,
  };
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function maxIsoDate(a: string, b: string): string {
  return a > b ? a : b;
}

function minIsoDate(a: string, b: string): string {
  return a < b ? a : b;
}

function dedupeByKey(identities: ChoreInstanceIdentity[]): ChoreInstanceIdentity[] {
  return Array.from(new Map(identities.map((identity) => [instanceIdentityKey(identity), identity])).values());
}
