export type DateGroupedItem = {
  occurrence_date: string;
};

export type TaskDateFilter = "today" | "week";

export type DateGroupedSection<TItem extends DateGroupedItem> = {
  items: TItem[];
  description: string;
  id: string;
  title: string;
};

export function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function endOfWeekSunday(date: string) {
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return addDays(date, (7 - weekday) % 7);
}

export function buildDateGroupedSections<TItem extends DateGroupedItem>(
  items: TItem[],
  today: string,
  isDailyRecurring: (item: TItem) => boolean = () => false,
): DateGroupedSection<TItem>[] {
  const weekEnd = endOfWeekSunday(today);

  const todayItems = items.filter((item) => item.occurrence_date === today);
  const weekItems = items.filter(
    (item) =>
      item.occurrence_date > today &&
      item.occurrence_date <= weekEnd &&
      !isDailyRecurring(item),
  );
  const wheneverItems = items.filter((item) => item.occurrence_date > weekEnd);

  return [
    {
      items: todayItems,
      description: "Due today.",
      id: "today",
      title: "Today",
    },
    {
      items: weekItems,
      description: "Due before this Sunday.",
      id: "week",
      title: "This week",
    },
    {
      items: wheneverItems,
      description: "Not urgent yet.",
      id: "whenever",
      title: "Whenever",
    },
  ];
}
