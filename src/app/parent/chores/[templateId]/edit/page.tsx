import Link from "next/link";
import { redirect } from "next/navigation";
import { updateChoreTemplateAction } from "@/app/parent/chores/[templateId]/edit/actions";
import { ChoreTemplateFormFields } from "@/components/chore-template-form-fields";
import { ParentNav } from "@/components/parent-nav";
import { AppShell } from "@/components/ui";
import { getCurrentParentHouseholdId, requireCurrentProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

  const { data: checklistItems, error: checklistError } = await supabase
    .from("chore_template_checklist_items")
    .select("label")
    .eq("template_id", template.id)
    .order("position", { ascending: true });

  if (checklistError) {
    throw new Error(checklistError.message);
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
    <AppShell variant="web">
        <header className="grid gap-4">
          <ParentNav />
          <div className="grid gap-2">
            <Link className="w-fit text-base font-semibold text-[var(--accent-strong)]" href="/parent/chores">
              Back to Chores
            </Link>
            <p className="text-base font-semibold text-[var(--muted)]">
              Saved household chore
            </p>
            <h1 className="text-3xl font-semibold leading-tight">Edit {template.title}</h1>
            <p className="max-w-xl text-lg text-[var(--muted)]">
              Update this saved chore's schedule, assignment, proof, and value.
            </p>
          </div>
        </header>

        {queryParams.error ? (
          <p className="rounded-2xl border border-[var(--danger)] bg-[var(--surface-elevated)] p-4 text-lg font-medium text-[var(--danger)]">
            {queryParams.error}
          </p>
        ) : null}

        {!template.active ? (
          <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 text-lg text-[var(--muted)]">
            This template is inactive. Reactivate support is not part of this edit flow yet.
          </p>
        ) : (
          <form action={updateChoreTemplateAction} className="grid max-w-2xl gap-6">
            <input name="templateId" type="hidden" value={template.id} />
            <ChoreTemplateFormFields
              cancelHref="/parent/chores"
              children={children}
              defaults={{
                amountDollars: dollarsFromCents(template.amount_cents),
                approvalRequired: template.approval_required,
                assignmentMode: template.assignment_mode,
                checklistItems: checklistItems?.map((item) => item.label) ?? [],
                description: template.description ?? "",
                dueTimeEnd: template.due_time_end ?? "",
                dueTimeStart: template.due_time_start ?? "",
                intervalDays: template.interval_days,
                oneOffDate: template.one_off_date ?? "",
                photoRequired: template.photo_required,
                scheduleType: template.schedule_type,
                selectedChildProfileIds: [...selectedChildProfileIds],
                startDate: template.start_date,
                title: template.title,
                valueModel: defaultValueModel,
                weeklyWeekdays: [...selectedWeeklyWeekdays],
              }}
              moneyFeaturesEnabled={moneyFeaturesEnabled}
              submitLabel="Save changes"
            />
          </form>
        )}
    </AppShell>
  );
}
