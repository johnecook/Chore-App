"use client";

import { useState, type ReactNode } from "react";
import { SectionHeader, SegmentedControl } from "@/components/rhythm-child-today-static";
import type { TaskDateFilter } from "@/domain/kid-home";

type TaskBucket = {
  availableContent: ReactNode;
  availableCount: number;
  completedCount: number;
  taskContent: ReactNode;
  totalTaskCount: number;
};

export function KidTaskFilter({
  today,
  week,
}: {
  today: TaskBucket;
  week: TaskBucket;
}) {
  const [filter, setFilter] = useState<TaskDateFilter>("today");
  const activeBucket = filter === "week" ? week : today;
  const progressPercentage = activeBucket.totalTaskCount
    ? Math.round((activeBucket.completedCount / activeBucket.totalTaskCount) * 100)
    : 0;

  return (
    <>
      <SegmentedControl
        items={[
          { label: "Today", onSelect: () => setFilter("today"), selected: filter === "today" },
          { label: "This Week", onSelect: () => setFilter("week"), selected: filter === "week" },
        ]}
      />

      {activeBucket.totalTaskCount ? (
        <section className="grid gap-2" aria-labelledby="tasks-heading">
          <SectionHeader
            action={`${activeBucket.completedCount} of ${activeBucket.totalTaskCount} done`}
            title="My tasks"
          />
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.10]">
            <div
              className="h-full rounded-full bg-[#45F1F1]"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          {activeBucket.taskContent}
        </section>
      ) : (
        <div className="rounded-[20px] bg-[linear-gradient(145deg,rgba(43,59,120,0.96),rgba(11,36,88,0.96))] p-4">
          <p className="text-lg font-bold text-white">
            No chores are ready to submit {filter === "week" ? "this week" : "today"}.
          </p>
        </div>
      )}

      {activeBucket.availableCount ? (
        <section className="grid gap-2" aria-labelledby="available-heading">
          <SectionHeader title="Available" />
          {activeBucket.availableContent}
        </section>
      ) : null}
    </>
  );
}
