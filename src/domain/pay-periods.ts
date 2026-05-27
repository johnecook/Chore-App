import type { PayCycleType, Weekday } from "./types";

export type PayCycleSetting =
  | { type: "weekly"; weekday: Weekday }
  | { type: "biweekly"; weekday: Weekday; anchorDate: string }
  | { type: "monthly_date"; dayOfMonth: number }
  | { type: "monthly_weekday"; ordinal: 1 | 2 | 3 | 4 | "last"; weekday: Weekday };

export type PayPeriod = {
  startDate: string;
  endDate: string;
  cycleType: PayCycleType;
};

export function payPeriodForDate(date: string, setting: PayCycleSetting): PayPeriod {
  if (setting.type === "weekly") {
    const endDate = nextWeekdayOnOrAfter(date, setting.weekday);
    return { startDate: addDays(endDate, -6), endDate, cycleType: setting.type };
  }

  if (setting.type === "biweekly") {
    const anchorEnd = nextWeekdayOnOrAfter(setting.anchorDate, setting.weekday);
    const daysFromAnchor = daysBetween(anchorEnd, date);
    const periodsFromAnchor = Math.floor(daysFromAnchor / 14);
    let endDate = addDays(anchorEnd, periodsFromAnchor * 14);
    if (date > endDate) {
      endDate = addDays(endDate, 14);
    }
    return { startDate: addDays(endDate, -13), endDate, cycleType: setting.type };
  }

  if (setting.type === "monthly_date") {
    const currentEnd = monthlyDateEnd(date.slice(0, 7), setting.dayOfMonth);
    const endDate = date <= currentEnd ? currentEnd : monthlyDateEnd(addMonths(date.slice(0, 7), 1), setting.dayOfMonth);
    const previousMonth = addMonths(endDate.slice(0, 7), -1);
    return { startDate: addDays(monthlyDateEnd(previousMonth, setting.dayOfMonth), 1), endDate, cycleType: setting.type };
  }

  const currentEnd = monthlyWeekdayEnd(date.slice(0, 7), setting.ordinal, setting.weekday);
  const endDate =
    date <= currentEnd
      ? currentEnd
      : monthlyWeekdayEnd(addMonths(date.slice(0, 7), 1), setting.ordinal, setting.weekday);
  const previousMonth = addMonths(endDate.slice(0, 7), -1);
  return {
    startDate: addDays(monthlyWeekdayEnd(previousMonth, setting.ordinal, setting.weekday), 1),
    endDate,
    cycleType: setting.type,
  };
}

function nextWeekdayOnOrAfter(date: string, weekday: Weekday): string {
  const current = new Date(`${date}T00:00:00.000Z`).getUTCDay() as Weekday;
  const delta = (weekday - current + 7) % 7;
  return addDays(date, delta);
}

function monthlyDateEnd(yearMonth: string, dayOfMonth: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(dayOfMonth, lastDay);
  return `${yearMonth}-${String(day).padStart(2, "0")}`;
}

function monthlyWeekdayEnd(yearMonth: string, ordinal: 1 | 2 | 3 | 4 | "last", weekday: Weekday): string {
  const [year, month] = yearMonth.split("-").map(Number);
  if (ordinal === "last") {
    const lastDay = new Date(Date.UTC(year, month, 0));
    const delta = (lastDay.getUTCDay() - weekday + 7) % 7;
    lastDay.setUTCDate(lastDay.getUTCDate() - delta);
    return lastDay.toISOString().slice(0, 10);
  }

  const first = new Date(Date.UTC(year, month - 1, 1));
  const delta = (weekday - first.getUTCDay() + 7) % 7;
  first.setUTCDate(1 + delta + (ordinal - 1) * 7);
  return first.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function addMonths(yearMonth: string, months: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1 + months, 1));
  return next.toISOString().slice(0, 7);
}

function daysBetween(startDate: string, endDate: string): number {
  return Math.floor(
    (Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) /
      86_400_000,
  );
}
