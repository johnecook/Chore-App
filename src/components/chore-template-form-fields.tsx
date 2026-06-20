"use client";

import { useMemo, useState } from "react";
import type { Database } from "@/lib/supabase/database.types";

type ScheduleType = Database["public"]["Enums"]["chore_schedule_type"];
type AssignmentMode = Database["public"]["Enums"]["chore_assignment_mode"];
type RotationCadence = Database["public"]["Enums"]["chore_rotation_cadence"];
type RotationChildScope = Database["public"]["Enums"]["chore_rotation_child_scope"];
type ValueModel = Database["public"]["Enums"]["chore_value_model"];

type ChildOption = {
  id: string;
  name: string;
};

type ChoreTemplateFormDefaults = {
  amountDollars?: string;
  approvalRequired: boolean;
  assignmentMode: AssignmentMode;
  checklistItems?: string[];
  description?: string;
  dueTimeEnd?: string;
  dueTimeStart?: string;
  intervalDays?: number | null;
  oneOffDate?: string;
  photoRequired: boolean;
  rotationCadence?: RotationCadence | null;
  rotationChildScope?: RotationChildScope | null;
  rotationStartChildProfileId?: string | null;
  scheduleType: ScheduleType;
  selectedChildProfileIds?: string[];
  startDate: string;
  title?: string;
  valueModel: ValueModel;
  weeklyWeekdays?: string[];
};

const weekdays = [
  ["0", "Sun"],
  ["1", "Mon"],
  ["2", "Tue"],
  ["3", "Wed"],
  ["4", "Thu"],
  ["5", "Fri"],
  ["6", "Sat"],
] as const;

export function ChoreTemplateFormFields({
  cancelHref,
  children,
  defaults,
  moneyFeaturesEnabled,
  submitLabel,
}: {
  cancelHref?: string;
  children: ChildOption[];
  defaults: ChoreTemplateFormDefaults;
  moneyFeaturesEnabled: boolean;
  submitLabel: string;
}) {
  const [scheduleType, setScheduleType] = useState(defaults.scheduleType);
  const [assignmentMode, setAssignmentMode] = useState(defaults.assignmentMode);
  const [rotationChildScope, setRotationChildScope] = useState<RotationChildScope>(
    defaults.rotationChildScope ?? "all_children",
  );
  const [valueModel, setValueModel] = useState(defaults.valueModel);
  const [checklistItems, setChecklistItems] = useState(() =>
    defaults.checklistItems?.length ? defaults.checklistItems : [""],
  );
  const selectedChildProfileIds = useMemo(
    () => new Set(defaults.selectedChildProfileIds ?? []),
    [defaults.selectedChildProfileIds],
  );
  const selectedWeeklyWeekdays = useMemo(
    () => new Set(defaults.weeklyWeekdays ?? []),
    [defaults.weeklyWeekdays],
  );
  const showAmount = moneyFeaturesEnabled && valueModel === "fixed";

  return (
    <>
      <section className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4">
        <h2 className="text-xl font-semibold">Basics</h2>
        <label className="grid gap-2 text-lg font-semibold">
          Title
          <input
            className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
            defaultValue={defaults.title ?? ""}
            maxLength={120}
            name="title"
            required
            type="text"
          />
        </label>
        <label className="grid gap-2 text-lg font-semibold">
          Description
          <textarea
            className="min-h-28 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
            defaultValue={defaults.description ?? ""}
            maxLength={500}
            name="description"
          />
        </label>
      </section>

      <section className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4">
        <h2 className="text-xl font-semibold">Schedule</h2>
        <label className="grid gap-2 text-lg font-semibold">
          Type
          <select
            className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
            name="scheduleType"
            onChange={(event) => setScheduleType(event.target.value as ScheduleType)}
            value={scheduleType}
          >
            <option value="one_off">Specific date</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="interval">Every few days</option>
          </select>
        </label>
        <label className="grid gap-2 text-lg font-semibold">
          Start date
          <input
            className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
            defaultValue={defaults.startDate}
            name="startDate"
            required
            type="date"
          />
        </label>
        {scheduleType === "one_off" ? (
          <label className="grid gap-2 text-lg font-semibold">
            Date
            <input
              className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
              defaultValue={defaults.oneOffDate ?? defaults.startDate}
              name="oneOffDate"
              required
              type="date"
            />
          </label>
        ) : null}
        {scheduleType === "weekly" ? (
          <fieldset className="grid gap-3">
            <legend className="text-lg font-semibold">Weekly days</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {weekdays.map(([value, label]) => (
                <label
                  className="flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-lg font-medium"
                  key={value}
                >
                  <input
                    className="size-5"
                    defaultChecked={selectedWeeklyWeekdays.has(value)}
                    name="weeklyWeekdays"
                    type="checkbox"
                    value={value}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        {scheduleType === "interval" ? (
          <label className="grid gap-2 text-lg font-semibold">
            Interval days
            <input
              className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
              defaultValue={defaults.intervalDays ?? ""}
              min={1}
              name="intervalDays"
              placeholder="3"
              required
              type="number"
            />
          </label>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-lg font-semibold">
            Due after
            <input
              className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
              defaultValue={defaults.dueTimeStart ?? ""}
              name="dueTimeStart"
              type="time"
            />
          </label>
          <label className="grid gap-2 text-lg font-semibold">
            Due before
            <input
              className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
              defaultValue={defaults.dueTimeEnd ?? ""}
              name="dueTimeEnd"
              type="time"
            />
          </label>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4">
        <h2 className="text-xl font-semibold">Value</h2>
        {!moneyFeaturesEnabled ? (
          <p className="text-base text-[var(--muted)]">
            Money features are off for this household, so fixed payouts are unavailable.
          </p>
        ) : null}
        <label className="grid gap-2 text-lg font-semibold">
          Model
          <select
            className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
            name="valueModel"
            onChange={(event) => setValueModel(event.target.value as ValueModel)}
            value={valueModel}
          >
            {moneyFeaturesEnabled ? <option value="fixed">Fixed amount</option> : null}
            <option value="allowance_included">Allowance included</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </label>
        {showAmount ? (
          <label className="grid gap-2 text-lg font-semibold">
            Amount
            <input
              className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
              defaultValue={defaults.amountDollars ?? ""}
              min="0"
              name="amountDollars"
              placeholder="5.00"
              required
              step="0.01"
              type="number"
            />
          </label>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4">
        <h2 className="text-xl font-semibold">Assignment</h2>
        <label className="grid gap-2 text-lg font-semibold">
          Mode
          <select
            className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
            name="assignmentMode"
            onChange={(event) => setAssignmentMode(event.target.value as AssignmentMode)}
            value={assignmentMode}
          >
            <option value="selected_children">Selected children</option>
            <option value="all_eligible_children">All eligible children</option>
            <option value="up_for_grabs">Up for grabs</option>
            <option value="rotation">Rotate</option>
          </select>
        </label>
        {assignmentMode === "rotation" ? (
          <div className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--background)] p-3">
            <label className="grid gap-2 text-base font-semibold">
              Rotation cadence
              <select
                className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
                defaultValue={defaults.rotationCadence ?? "weekly"}
                name="rotationCadence"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <fieldset className="grid gap-3">
              <legend className="text-base font-semibold">Children in rotation</legend>
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg font-medium">
                <input
                  checked={rotationChildScope === "all_children"}
                  name="rotationChildScope"
                  onChange={() => setRotationChildScope("all_children")}
                  type="radio"
                  value="all_children"
                />
                All children
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg font-medium">
                <input
                  checked={rotationChildScope === "selected_children"}
                  name="rotationChildScope"
                  onChange={() => setRotationChildScope("selected_children")}
                  type="radio"
                  value="selected_children"
                />
                Select children
              </label>
            </fieldset>
            {rotationChildScope === "selected_children" ? (
              <fieldset className="grid gap-3">
                <legend className="text-base font-semibold">Selected rotation children</legend>
                <div className="grid gap-2">
                  {children.map((child) => (
                    <label
                      className="flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-3 py-2 text-lg font-medium"
                      key={child.id}
                    >
                      <input
                        className="size-5"
                        defaultChecked={selectedChildProfileIds.has(child.id)}
                        name="selectedChildProfileIds"
                        type="checkbox"
                        value={child.id}
                      />
                      {child.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <label className="grid gap-2 text-base font-semibold">
              Start rotation with
              <select
                className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
                defaultValue={defaults.rotationStartChildProfileId ?? ""}
                name="rotationStartChildProfileId"
              >
                <option value="">First child in the list</option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-base text-[var(--muted)]">
              Rotation starts from the chore start date and skips unavailable children.
            </p>
          </div>
        ) : null}
        {assignmentMode === "selected_children" ? (
          <fieldset className="grid gap-3">
            <legend className="text-lg font-semibold">Selected children</legend>
            <div className="grid gap-2">
              {children.map((child) => (
                <label
                  className="flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-lg font-medium"
                  key={child.id}
                >
                  <input
                    className="size-5"
                    defaultChecked={selectedChildProfileIds.has(child.id)}
                    name="selectedChildProfileIds"
                    type="checkbox"
                    value={child.id}
                  />
                  {child.name}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Checklist</h2>
          <button
            className="min-h-10 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-3 py-2 text-base font-semibold text-[var(--accent-strong)]"
            disabled={checklistItems.length >= 20}
            onClick={() => setChecklistItems((items) => [...items, ""])}
            type="button"
          >
            Add item
          </button>
        </div>
        <div className="grid gap-3">
          {checklistItems.map((item, index) => (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]" key={index}>
              <label className="grid gap-2 text-lg font-semibold">
                Item {index + 1}
                <input
                  className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
                  maxLength={120}
                  name="checklistItems"
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setChecklistItems((items) =>
                      items.map((currentItem, currentIndex) =>
                        currentIndex === index ? nextValue : currentItem,
                      ),
                    );
                  }}
                  placeholder="Clean sink"
                  type="text"
                  value={item}
                />
              </label>
              {checklistItems.length > 1 ? (
                <button
                  className="min-h-12 self-end rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-base font-semibold text-[var(--danger)]"
                  onClick={() =>
                    setChecklistItems((items) => items.filter((_, currentIndex) => currentIndex !== index))
                  }
                  type="button"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4">
        <h2 className="text-xl font-semibold">Proof</h2>
        <label className="flex min-h-12 items-center gap-3 text-lg font-semibold">
          <input
            className="size-5"
            defaultChecked={defaults.photoRequired}
            name="photoRequired"
            type="checkbox"
          />
          Photo required
        </label>
        <label className="flex min-h-12 items-center gap-3 text-lg font-semibold">
          <input
            className="size-5"
            defaultChecked={defaults.approvalRequired}
            name="approvalRequired"
            type="checkbox"
          />
          Parent approval required
        </label>
      </section>

      <div aria-hidden="true" className="h-24" />
      <div className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-2xl flex-wrap gap-3 rounded-2xl border border-[var(--line)] bg-[rgba(8,24,66,0.96)] p-2 shadow-[0_18px_54px_rgba(1,6,22,0.42)] backdrop-blur">
        <button className="min-h-12 rounded-2xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
          {submitLabel}
        </button>
        {cancelHref ? (
          <a
            className="inline-flex min-h-12 items-center rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-5 py-3 text-lg font-semibold"
            href={cancelHref}
          >
            Cancel
          </a>
        ) : null}
      </div>
    </>
  );
}
