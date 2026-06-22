import Link from "next/link";
import { redirect } from "next/navigation";
import { updateChoreTemplateAction } from "@/app/parent/chores/[templateId]/edit/actions";
import { ChoreTemplateFormFields } from "@/components/chore-template-form-fields";
import { ParentNav } from "@/components/parent-nav";
import { AppShell } from "@/components/ui";
import { getCurrentParentHouseholdId, requireCurrentProfile } from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParamValue = string | string[] | undefined;
type EditChoreSearchParams = {
  [key: string]: SearchParamValue;
  draft?: SearchParamValue;
  error?: SearchParamValue;
};

const scheduleTypes = ["daily", "weekly", "interval", "one_off"] as const;
const assignmentModes = [
  "selected_children",
  "all_eligible_children",
  "up_for_grabs",
  "rotation",
] as const;
const rotationCadences = ["daily", "weekly", "monthly"] as const;
const rotationChildScopes = ["all_children", "selected_children"] as const;
const valueModels = ["fixed", "allowance_included", "unpaid"] as const;

function dollarsFromCents(cents: number) {
  return cents > 0 ? (cents / 100).toFixed(2) : "";
}

function paramString(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function paramStringArray(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
}

function paramEnum<T extends string>(value: SearchParamValue, allowedValues: readonly T[], fallback: T) {
  const stringValue = paramString(value);
  return allowedValues.includes(stringValue as T) ? (stringValue as T) : fallback;
}

function paramBoolean(value: SearchParamValue, fallback: boolean) {
  const stringValue = paramString(value);

  if (stringValue === "on") {
    return true;
  }

  if (stringValue === "off") {
    return false;
  }

  return fallback;
}

function paramNumber(value: SearchParamValue, fallback: number | null) {
  const stringValue = paramString(value);

  if (!stringValue) {
    return fallback;
  }

  const parsedValue = Number(stringValue);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function isMissingColumnError(error: { message: string } | null) {
  return Boolean(error?.message.includes("column") && error.message.includes("does not exist"));
}

export default async function EditChoreTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<EditChoreSearchParams>;
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
  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("id, money_features_enabled")
    .eq("id", householdId)
    .maybeSingle();

  const templateQuery = await supabase
    .from("chore_templates")
    .select(
      "id, title, description, schedule_type, start_date, weekly_weekdays, interval_days, one_off_date, due_time_start, due_time_end, assignment_mode, rotation_cadence, rotation_child_scope, rotation_start_child_profile_id, value_model, amount_cents, photo_required, approval_required, active",
    )
    .eq("id", routeParams.templateId)
    .eq("household_id", householdId)
    .maybeSingle();

  const fallbackTemplateQuery = isMissingColumnError(templateQuery.error)
    ? await supabase
        .from("chore_templates")
        .select(
          "id, title, description, schedule_type, start_date, weekly_weekdays, interval_days, one_off_date, due_time_start, due_time_end, assignment_mode, value_model, amount_cents, photo_required, approval_required, active",
        )
        .eq("id", routeParams.templateId)
        .eq("household_id", householdId)
        .maybeSingle()
    : null;

  const template = fallbackTemplateQuery?.data ?? templateQuery.data;
  const templateError = fallbackTemplateQuery?.error ?? (fallbackTemplateQuery ? null : templateQuery.error);

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

  const assigneeQuery = await supabase
    .from("chore_template_assignees")
    .select("child_profile_id")
    .eq("template_id", template.id)
    .order("position", { ascending: true });

  const fallbackAssigneeQuery = isMissingColumnError(assigneeQuery.error)
    ? await supabase
        .from("chore_template_assignees")
        .select("child_profile_id")
        .eq("template_id", template.id)
    : null;
  const assignees = fallbackAssigneeQuery?.data ?? assigneeQuery.data;
  const assigneeError = fallbackAssigneeQuery?.error ?? (fallbackAssigneeQuery ? null : assigneeQuery.error);

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
  const hasDraft = paramString(queryParams.draft) === "1";
  const draftValueModel = paramEnum(queryParams.valueModel, valueModels, defaultValueModel);
  const defaultRotationCadence = (
    "rotation_cadence" in template ? template.rotation_cadence : null
  ) as Database["public"]["Enums"]["chore_rotation_cadence"] | null;
  const defaultRotationChildScope = (
    "rotation_child_scope" in template ? template.rotation_child_scope : null
  ) as Database["public"]["Enums"]["chore_rotation_child_scope"] | null;
  const defaultRotationStartChildProfileId = (
    "rotation_start_child_profile_id" in template ? template.rotation_start_child_profile_id : null
  ) as string | null;
  const formDefaults = {
    amountDollars: hasDraft ? (paramString(queryParams.amountDollars) ?? "") : dollarsFromCents(template.amount_cents),
    approvalRequired: hasDraft
      ? paramBoolean(queryParams.approvalRequired, template.approval_required)
      : template.approval_required,
    assignmentMode: hasDraft
      ? paramEnum(queryParams.assignmentMode, assignmentModes, template.assignment_mode)
      : template.assignment_mode,
    checklistItems: hasDraft ? paramStringArray(queryParams.checklistItems) : (checklistItems?.map((item) => item.label) ?? []),
    description: hasDraft ? (paramString(queryParams.description) ?? "") : (template.description ?? ""),
    dueTimeEnd: hasDraft ? (paramString(queryParams.dueTimeEnd) ?? "") : (template.due_time_end ?? ""),
    dueTimeStart: hasDraft ? (paramString(queryParams.dueTimeStart) ?? "") : (template.due_time_start ?? ""),
    intervalDays: hasDraft ? paramNumber(queryParams.intervalDays, template.interval_days) : template.interval_days,
    oneOffDate: hasDraft ? (paramString(queryParams.oneOffDate) ?? "") : (template.one_off_date ?? ""),
    photoRequired: hasDraft
      ? paramBoolean(queryParams.photoRequired, template.photo_required)
      : template.photo_required,
    rotationCadence: hasDraft
      ? paramEnum(queryParams.rotationCadence, rotationCadences, defaultRotationCadence ?? "weekly")
      : defaultRotationCadence,
    rotationChildScope: hasDraft
      ? paramEnum(queryParams.rotationChildScope, rotationChildScopes, defaultRotationChildScope ?? "all_children")
      : defaultRotationChildScope,
    rotationStartChildProfileId: hasDraft
      ? (paramString(queryParams.rotationStartChildProfileId) ?? null)
      : defaultRotationStartChildProfileId,
    scheduleType: hasDraft
      ? paramEnum(queryParams.scheduleType, scheduleTypes, template.schedule_type)
      : template.schedule_type,
    selectedChildProfileIds: hasDraft
      ? paramStringArray(queryParams.selectedChildProfileIds)
      : [...selectedChildProfileIds],
    startDate: hasDraft ? (paramString(queryParams.startDate) ?? template.start_date) : template.start_date,
    title: hasDraft ? (paramString(queryParams.title) ?? "") : template.title,
    valueModel: draftValueModel === "fixed" && !moneyFeaturesEnabled ? "unpaid" : draftValueModel,
    weeklyWeekdays: hasDraft ? paramStringArray(queryParams.weeklyWeekdays) : [...selectedWeeklyWeekdays],
  };

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

        {paramString(queryParams.error) ? (
          <p className="rounded-2xl border border-[var(--danger)] bg-[var(--surface-elevated)] p-4 text-lg font-medium text-[var(--danger)]">
            {paramString(queryParams.error)}
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
              defaults={formDefaults}
              moneyFeaturesEnabled={moneyFeaturesEnabled}
              submitLabel="Save changes"
            />
          </form>
        )}
    </AppShell>
  );
}
