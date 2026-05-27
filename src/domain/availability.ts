import type { Weekday } from "./types";

export type AvailabilityOverride = {
  date: string;
  available: boolean;
  householdId: string;
};

export type RepeatingAvailabilityPattern = {
  householdId: string;
  anchorDate: string;
  cycleLengthDays: number;
  availableDayOffsets: number[];
};

export type AvailabilityInput = {
  date: string;
  householdId: string;
  basePattern: RepeatingAvailabilityPattern;
  overrides?: AvailabilityOverride[];
};

export function isoDateFromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function weekdayFromIsoDate(date: string): Weekday {
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return weekday as Weekday;
}

export function daysBetweenIsoDates(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  return Math.floor((end - start) / 86_400_000);
}

export function isChildAvailableForHousehold(input: AvailabilityInput): boolean {
  const matchingOverride = input.overrides?.find(
    (override) => override.householdId === input.householdId && override.date === input.date,
  );

  if (matchingOverride) {
    return matchingOverride.available;
  }

  if (input.basePattern.householdId !== input.householdId) {
    return false;
  }

  const daysFromAnchor = daysBetweenIsoDates(input.basePattern.anchorDate, input.date);
  const offset =
    ((daysFromAnchor % input.basePattern.cycleLengthDays) + input.basePattern.cycleLengthDays) %
    input.basePattern.cycleLengthDays;

  return input.basePattern.availableDayOffsets.includes(offset);
}
