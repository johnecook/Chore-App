import Link from "next/link";
import { redirect } from "next/navigation";
import { deactivateTemplateAction, reactivateTemplateAction } from "@/app/parent/actions";
import { ParentNav } from "@/components/parent-nav";
import { AppShell } from "@/components/ui";
import { getCurrentParentHouseholdId, requireCurrentProfile } from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ChoreTemplate = Pick<
  Database["public"]["Tables"]["chore_templates"]["Row"],
  | "active"
  | "amount_cents"
  | "approval_required"
  | "assignment_mode"
  | "due_time_end"
  | "due_time_start"
  | "id"
  | "interval_days"
  | "one_off_date"
  | "photo_required"
  | "schedule_type"
  | "title"
  | "value_model"
  | "weekly_weekdays"
>;

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDollars(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

function formatTime(value: string | null) {
  if (!value) {
    return null;
  }

  const [hours, minutes] = value.split(":");
  if (!hours || !minutes) {
    return value;
  }

  const hourNumber = Number(hours);
  if (Number.isNaN(hourNumber)) {
    return value;
  }

  const suffix = hourNumber >= 12 ? "PM" : "AM";
  const hour = hourNumber % 12 || 12;
  return `${hour}:${minutes} ${suffix}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function scheduleLabel(template: {
  interval_days: number | null;
  one_off_date: string | null;
  schedule_type: "daily" | "weekly" | "interval" | "one_off";
  weekly_weekdays: number[] | null;
}) {
  if (template.schedule_type === "daily") {
    return "Daily";
  }

  if (template.schedule_type === "weekly") {
    const weekdays =
      template.weekly_weekdays
        ?.map((weekday) => weekdayLabels[weekday])
        .filter(Boolean)
        .join(", ") ?? "";
    return weekdays ? `Weekly on ${weekdays}` : "Weekly";
  }

  if (template.schedule_type === "interval") {
    const days = template.interval_days ?? 1;
    return days === 1 ? "Every day" : `Every ${days} days`;
  }

  return template.one_off_date ? formatDate(template.one_off_date) : "Specific date";
}

function dueWindowLabel(template: { due_time_end: string | null; due_time_start: string | null }) {
  const start = formatTime(template.due_time_start);
  const end = formatTime(template.due_time_end);

  if (start && end) {
    return `${start}-${end}`;
  }

  if (end) {
    return `Due by ${end}`;
  }

  if (start) {
    return `Starts ${start}`;
  }

  return "No due window";
}

function assignmentLabel(mode: "all_eligible_children" | "selected_children" | "up_for_grabs") {
  if (mode === "all_eligible_children") {
    return "Every eligible child";
  }

  if (mode === "up_for_grabs") {
    return "Up for grabs";
  }

  return "Selected children";
}

function valueLabel(template: {
  amount_cents: number;
  value_model: "allowance_included" | "fixed" | "unpaid";
}) {
  if (template.value_model === "fixed") {
    return formatDollars(template.amount_cents);
  }

  if (template.value_model === "allowance_included") {
    return "Allowance included";
  }

  return "Unpaid";
}

export default async function ParentChoresPage({
  searchParams,
}: {
  searchParams: Promise<{
    createdChore?: string;
    deactivatedTemplate?: string;
    error?: string;
    reactivatedTemplate?: string;
    updatedTemplate?: string;
  }>;
}) {
  const [profile, householdId, params] = await Promise.all([
    requireCurrentProfile(),
    getCurrentParentHouseholdId(),
    searchParams,
  ]);

  if (profile.appRole === "child") {
    redirect("/kid");
  }

  if (!householdId) {
    redirect("/onboarding/household");
  }

  const supabase = await createSupabaseServerClient();
  const { data: choreTemplates, error: templateError } = await supabase
    .from("chore_templates")
    .select(
      "id, title, schedule_type, weekly_weekdays, interval_days, one_off_date, due_time_start, due_time_end, assignment_mode, value_model, amount_cents, photo_required, approval_required, active, created_at",
    )
    .eq("household_id", householdId)
    .order("active", { ascending: false })
    .order("created_at", { ascending: false });

  if (templateError) {
    throw new Error(templateError.message);
  }

  const activeTemplates = choreTemplates?.filter((template) => template.active) ?? [];
  const inactiveTemplates = choreTemplates?.filter((template) => !template.active) ?? [];
  const templateIds = choreTemplates?.map((template) => template.id) ?? [];
  const { data: checklistItems, error: checklistError } = templateIds.length
    ? await supabase
        .from("chore_template_checklist_items")
        .select("template_id")
        .in("template_id", templateIds)
    : { data: [], error: null };

  if (checklistError) {
    throw new Error(checklistError.message);
  }

  const checklistCountByTemplateId = new Map<string, number>();
  for (const item of checklistItems ?? []) {
    checklistCountByTemplateId.set(
      item.template_id,
      (checklistCountByTemplateId.get(item.template_id) ?? 0) + 1,
    );
  }

  return (
    <AppShell variant="web">
        <header className="grid gap-4">
          <ParentNav />
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid gap-2">
                <h1 className="text-3xl font-semibold leading-tight">Chores</h1>
                <p className="text-lg text-[var(--muted)]">
                  Manage recurring chores and chores for specific dates.
                </p>
              </div>
              <Link
                className="min-h-12 rounded-2xl bg-[var(--accent)] px-5 py-3 text-center text-lg font-semibold text-white"
                href="/parent/chores/new"
              >
                Add chore
              </Link>
            </div>
          </div>
        </header>

        {params.error ? (
          <p className="rounded-2xl border border-[var(--danger)] bg-[var(--surface-elevated)] p-4 text-lg font-medium text-[var(--danger)]">
            {params.error}
          </p>
        ) : null}

        {params.createdChore ? (
          <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 text-lg font-medium">
            Chore created.
          </p>
        ) : null}

        {params.updatedTemplate ? (
          <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 text-lg font-medium">
            Chore template updated.
          </p>
        ) : null}

        {params.deactivatedTemplate ? (
          <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 text-lg font-medium">
            Chore template deactivated.
          </p>
        ) : null}

        {params.reactivatedTemplate ? (
          <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 text-lg font-medium">
            Chore template reactivated.
          </p>
        ) : null}

        <section aria-labelledby="templates-heading" className="grid gap-5">
          <div className="grid gap-1">
            <h2 id="templates-heading" className="text-xl font-semibold">
              Templates
            </h2>
            <p className="text-base text-[var(--muted)]">
              Review schedule, assignment, and payout details before editing.
            </p>
          </div>
          {choreTemplates?.length ? (
            <div className="grid gap-6">
              <TemplateGroup
                checklistCountByTemplateId={checklistCountByTemplateId}
                templates={activeTemplates}
                title="Active"
              />
              {inactiveTemplates.length ? (
                <TemplateGroup
                  checklistCountByTemplateId={checklistCountByTemplateId}
                  inactive
                  templates={inactiveTemplates}
                  title="Inactive"
                />
              ) : null}
            </div>
          ) : (
            <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 text-lg text-[var(--muted)]">
              No chore templates yet.
            </p>
          )}
        </section>
    </AppShell>
  );
}

function TemplateGroup({
  checklistCountByTemplateId,
  inactive = false,
  templates,
  title,
}: {
  checklistCountByTemplateId: Map<string, number>;
  inactive?: boolean;
  templates: ChoreTemplate[];
  title: string;
}) {
  if (!templates.length) {
    return null;
  }

  return (
    <section aria-label={`${title} templates`} className="grid gap-3">
      <h3 className="text-lg font-semibold">
        {title} ({templates.length})
      </h3>
      <div className="grid gap-3">
        {templates.map((template) => {
          const checklistCount = checklistCountByTemplateId.get(template.id) ?? 0;
          const detailItems = [
            scheduleLabel(template),
            dueWindowLabel(template),
            assignmentLabel(template.assignment_mode),
            valueLabel(template),
            checklistCount > 0
              ? `${checklistCount} checklist item${checklistCount === 1 ? "" : "s"}`
              : null,
            template.photo_required ? "Photo required" : "No photo",
            template.approval_required ? "Parent approval" : "Auto-approve",
          ].filter((item): item is string => item !== null);

          return (
            <article
              className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 sm:grid-cols-[1fr_auto] sm:items-start"
              key={template.id}
            >
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-xl font-semibold leading-snug">{template.title}</h4>
                  {inactive ? (
                    <span className="rounded-xl border border-[var(--line)] px-2 py-1 text-sm font-semibold text-[var(--muted)]">
                      Inactive
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {detailItems.map((item) => (
                    <span
                      className="rounded-xl border border-[var(--line)] px-2 py-1 text-sm font-medium text-[var(--muted)]"
                      key={item}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {template.active ? (
                  <>
                    <Link
                      className="inline-flex min-h-10 items-center rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-3 py-2 text-base font-semibold"
                      href={`/parent/chores/${template.id}/edit`}
                    >
                      Edit
                    </Link>
                    <form action={deactivateTemplateAction}>
                      <input name="templateId" type="hidden" value={template.id} />
                      <input name="redirectTo" type="hidden" value="chores" />
                      <button className="min-h-10 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-3 py-2 text-base font-semibold text-[var(--danger)]">
                        Deactivate
                      </button>
                    </form>
                  </>
                ) : (
                  <form action={reactivateTemplateAction}>
                    <input name="templateId" type="hidden" value={template.id} />
                    <button className="min-h-10 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-3 py-2 text-base font-semibold text-[var(--accent-strong)]">
                      Reactivate
                    </button>
                  </form>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
