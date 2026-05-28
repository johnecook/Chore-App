import { redirect } from "next/navigation";
import { updateChoreTemplateAction } from "@/app/parent/chores/[templateId]/edit/actions";
import { ParentNav } from "@/components/parent-nav";
import { getCurrentParentHouseholdId, requireCurrentProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const weekdays = [
  ["0", "Sun"],
  ["1", "Mon"],
  ["2", "Tue"],
  ["3", "Wed"],
  ["4", "Thu"],
  ["5", "Fri"],
  ["6", "Sat"],
] as const;

function dollarsFromCents(cents: number) {
  return cents > 0 ? (cents / 100).toFixed(2) : "";
}

export default async function EditChoreTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [profile, householdId, routeParams, queryParams] = await Promise.all([
    requireCurrentProfile(),
    getCurrentParentHouseholdId(),
    params,
    searchParams,
  ]);

  if (profile.appRole === "child") {
    redirect("/kid");
  }

  if (!householdId) {
    redirect("/onboarding/household");
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: household, error: householdError }, { data: template, error: templateError }] =
    await Promise.all([
      supabase
        .from("households")
        .select("id, money_features_enabled")
        .eq("id", householdId)
        .maybeSingle(),
      supabase
        .from("chore_templates")
        .select(
          "id, title, description, schedule_type, start_date, weekly_weekdays, interval_days, one_off_date, due_time_start, due_time_end, assignment_mode, value_model, amount_cents, photo_required, approval_required, active",
        )
        .eq("id", routeParams.templateId)
        .eq("household_id", householdId)
        .maybeSingle(),
    ]);

  if (householdError) {
    throw new Error(householdError.message);
  }

  if (templateError) {
    throw new Error(templateError.message);
  }

  if (!template) {
    redirect("/parent/chores?error=That chore template could not be found.");
  }

  const { data: childMemberships, error: membershipError } = await supabase
    .from("household_memberships")
    .select("user_id")
    .eq("household_id", householdId)
    .eq("role", "child");

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const childUserIds = childMemberships?.map((membership) => membership.user_id) ?? [];
  const [{ data: childProfiles, error: childProfileError }, { data: childUsers, error: childUserError }] =
    childUserIds.length
      ? await Promise.all([
          supabase.from("child_profiles").select("id, user_id").in("user_id", childUserIds),
          supabase.from("profiles").select("id, display_name").in("id", childUserIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];

  if (childProfileError) {
    throw new Error(childProfileError.message);
  }

  if (childUserError) {
    throw new Error(childUserError.message);
  }

  const { data: assignees, error: assigneeError } = await supabase
    .from("chore_template_assignees")
    .select("child_profile_id")
    .eq("template_id", template.id);

  if (assigneeError) {
    throw new Error(assigneeError.message);
  }

  const moneyFeaturesEnabled = household?.money_features_enabled ?? false;
  const children = childProfiles.map((childProfile) => {
    const childUser = childUsers?.find((user) => user.id === childProfile.user_id);
    return {
      id: childProfile.id,
      name: childUser?.display_name ?? "Child",
    };
  });
  const selectedWeeklyWeekdays = new Set(
    template.weekly_weekdays?.map((weekday) => String(weekday)) ?? [],
  );
  const selectedChildProfileIds = new Set(
    assignees?.map((assignee) => assignee.child_profile_id) ?? [],
  );
  const defaultValueModel =
    template.value_model === "fixed" && !moneyFeaturesEnabled ? "unpaid" : template.value_model;

  return (
    <main className="page-shell">
      <div className="grid gap-8 py-6">
        <header className="grid gap-4">
          <ParentNav />
          <div className="grid gap-2">
            <p className="text-base font-semibold capitalize text-[var(--muted)]">
              {template.schedule_type.replace("_", "-")} template
            </p>
            <h1 className="text-3xl font-semibold leading-tight">Edit chore</h1>
          </div>
        </header>

        {queryParams.error ? (
          <p className="rounded-lg border border-[var(--danger)] bg-white p-4 text-lg font-medium text-[var(--danger)]">
            {queryParams.error}
          </p>
        ) : null}

        {!template.active ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg text-[var(--muted)]">
            This template is inactive. Reactivate support is not part of this edit flow yet.
          </p>
        ) : (
          <form action={updateChoreTemplateAction} className="grid max-w-2xl gap-6">
            <input name="templateId" type="hidden" value={template.id} />

            <section className="grid gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
              <h2 className="text-xl font-semibold">Basics</h2>
              <label className="grid gap-2 text-lg font-semibold">
                Title
                <input
                  className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                  defaultValue={template.title}
                  maxLength={120}
                  name="title"
                  required
                  type="text"
                />
              </label>
              <label className="grid gap-2 text-lg font-semibold">
                Description
                <textarea
                  className="min-h-28 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                  defaultValue={template.description ?? ""}
                  maxLength={500}
                  name="description"
                />
              </label>
            </section>

            <section className="grid gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
              <h2 className="text-xl font-semibold">Schedule</h2>
              <label className="grid gap-2 text-lg font-semibold">
                Type
                <select
                  className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                  defaultValue={template.schedule_type}
                  name="scheduleType"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="interval">Interval</option>
                  <option value="one_off">One-off</option>
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-lg font-semibold">
                  Start date
                  <input
                    className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                    defaultValue={template.start_date}
                    name="startDate"
                    required
                    type="date"
                  />
                </label>
                <label className="grid gap-2 text-lg font-semibold">
                  One-off date
                  <input
                    className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                    defaultValue={template.one_off_date ?? ""}
                    name="oneOffDate"
                    type="date"
                  />
                </label>
              </div>
              <fieldset className="grid gap-3">
                <legend className="text-lg font-semibold">Weekly days</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {weekdays.map(([value, label]) => (
                    <label
                      className="flex min-h-12 items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-lg font-medium"
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
              <label className="grid gap-2 text-lg font-semibold">
                Interval days
                <input
                  className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                  defaultValue={template.interval_days ?? ""}
                  min={1}
                  name="intervalDays"
                  placeholder="3"
                  type="number"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-lg font-semibold">
                  Due after
                  <input
                    className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                    defaultValue={template.due_time_start ?? ""}
                    name="dueTimeStart"
                    type="time"
                  />
                </label>
                <label className="grid gap-2 text-lg font-semibold">
                  Due before
                  <input
                    className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                    defaultValue={template.due_time_end ?? ""}
                    name="dueTimeEnd"
                    type="time"
                  />
                </label>
              </div>
            </section>

            <section className="grid gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
              <h2 className="text-xl font-semibold">Value</h2>
              {!moneyFeaturesEnabled ? (
                <p className="text-base text-[var(--muted)]">
                  Money features are off for this household, so fixed payouts are unavailable.
                </p>
              ) : null}
              <label className="grid gap-2 text-lg font-semibold">
                Model
                <select
                  className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                  defaultValue={defaultValueModel}
                  name="valueModel"
                >
                  {moneyFeaturesEnabled ? <option value="fixed">Fixed amount</option> : null}
                  <option value="allowance_included">Allowance included</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </label>
              {moneyFeaturesEnabled ? (
                <label className="grid gap-2 text-lg font-semibold">
                  Amount
                  <input
                    className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                    defaultValue={dollarsFromCents(template.amount_cents)}
                    min="0"
                    name="amountDollars"
                    placeholder="5.00"
                    step="0.01"
                    type="number"
                  />
                </label>
              ) : null}
            </section>

            <section className="grid gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
              <h2 className="text-xl font-semibold">Assignment</h2>
              <label className="grid gap-2 text-lg font-semibold">
                Mode
                <select
                  className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                  defaultValue={template.assignment_mode}
                  name="assignmentMode"
                >
                  <option value="selected_children">Selected children</option>
                  <option value="all_eligible_children">All eligible children</option>
                  <option value="up_for_grabs">Up for grabs</option>
                </select>
              </label>
              <fieldset className="grid gap-3">
                <legend className="text-lg font-semibold">Selected children</legend>
                <div className="grid gap-2">
                  {children.map((child) => (
                    <label
                      className="flex min-h-12 items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-lg font-medium"
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
            </section>

            <section className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
              <h2 className="text-xl font-semibold">Proof</h2>
              <label className="flex min-h-12 items-center gap-3 text-lg font-semibold">
                <input
                  className="size-5"
                  defaultChecked={template.photo_required}
                  name="photoRequired"
                  type="checkbox"
                />
                Photo required
              </label>
              <label className="flex min-h-12 items-center gap-3 text-lg font-semibold">
                <input
                  className="size-5"
                  defaultChecked={template.approval_required}
                  name="approvalRequired"
                  type="checkbox"
                />
                Parent approval required
              </label>
            </section>

            <div className="flex flex-wrap gap-3">
              <button className="min-h-12 rounded-lg bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
                Save changes
              </button>
              <a
                className="inline-flex min-h-12 items-center rounded-lg border border-[var(--line)] bg-white px-5 py-3 text-lg font-semibold"
                href="/parent/chores"
              >
                Cancel
              </a>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
