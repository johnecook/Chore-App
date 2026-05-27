export type DateGroupedItem = {
  occurrence_date: string;
};

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

export function buildDateGroupedSections<TItem extends DateGroupedItem>(
  items: TItem[],
  today: string,
): DateGroupedSection<TItem>[] {
  const weekEnd = addDays(today, 7);

  const todayItems = items.filter((item) => item.occurrence_date <= today);
  const weekItems = items.filter(
    (item) => item.occurrence_date > today && item.occurrence_date <= weekEnd,
  );
  const wheneverItems = items.filter((item) => item.occurrence_date > weekEnd);

  return [
    {
      items: todayItems,
      description: "Ready now or already due.",
      id: "today",
      title: "Today",
    },
    {
      items: weekItems,
      description: "Coming up in the next week.",
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
