import { redirect } from "next/navigation";
import { createChoreTemplateAction } from "@/app/parent/chores/new/actions";
import { ChoreTemplateFormFields } from "@/components/chore-template-form-fields";
import { ParentNav } from "@/components/parent-nav";
import { AppShell } from "@/components/ui";
import { getCurrentParentHouseholdId, requireCurrentProfile } from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const presetCategories: Array<{
  value: Database["public"]["Enums"]["chore_template_preset_category"];
  label: string;
}> = [
  { value: "kitchen", label: "Kitchen" },
  { value: "bedroom", label: "Bedroom" },
  { value: "bathroom", label: "Bathroom" },
  { value: "laundry", label: "Laundry" },
  { value: "pets", label: "Pets" },
  { value: "outdoor", label: "Outdoor" },
  { value: "family", label: "Family" },
];

type ChorePreset = Database["public"]["Tables"]["chore_template_presets"]["Row"];
type SearchParamValue = string | string[] | undefined;
type NewChoreSearchParams = {
  [key: string]: SearchParamValue;
  draft?: SearchParamValue;
  error?: SearchParamValue;
  preset?: SearchParamValue;
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

function scheduleTypeLabel(scheduleType: Database["public"]["Enums"]["chore_schedule_type"]) {
  if (scheduleType === "daily") {
    return "Daily";
  }

  if (scheduleType === "weekly") {
    return "Weekly";
  }

  if (scheduleType === "interval") {
    return "Every few days";
  }

  return "Specific date";
}

function presetValueLabel(preset: ChorePreset, moneyFeaturesEnabled: boolean) {
  if (preset.suggested_value_model === "fixed") {
    return moneyFeaturesEnabled
      ? `$${dollarsFromCents(preset.suggested_amount_cents)}`
      : "Unpaid in chores-only mode";
  }

  if (preset.suggested_value_model === "allowance_included") {
    return "Allowance included";
  }

  return "Unpaid";
}

export default async function NewChorePage({
  searchParams,
}: {
  searchParams: Promise<NewChoreSearchParams>;
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
  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("id, money_features_enabled, money_mode")
    .eq("id", householdId)
    .maybeSingle();

  if (householdError) {
    throw new Error(householdError.message);
  }

  const moneyFeaturesEnabled = household?.money_features_enabled ?? false;
  const defaultHouseholdValueModel =
    household?.money_mode === "allowance_plus_bonus"
      ? "allowance_included"
      : moneyFeaturesEnabled
        ? "fixed"
        : "unpaid";
  const { data: childMemberships, error: membershipError } = await supabase
    .from("household_memberships")
    .select("user_id")
    .eq("household_id", householdId)
    .eq("role", "child");

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const childUserIds = childMemberships?.map((membership) => membership.user_id) ?? [];
  const { data: childProfiles, error: childProfileError } = childUserIds.length
    ? await supabase
        .from("child_profiles")
        .select("id, user_id")
        .in("user_id", childUserIds)
    : { data: [], error: null };

  if (childProfileError) {
    throw new Error(childProfileError.message);
  }

  const { data: childUsers, error: childUserError } = childUserIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", childUserIds)
    : { data: [], error: null };

  if (childUserError) {
    throw new Error(childUserError.message);
  }

  const { data: presets, error: presetError } = await supabase
    .from("chore_template_presets")
    .select(
      "id, slug, category, display_order, title, description, suggested_schedule_type, suggested_weekly_weekdays, suggested_interval_days, suggested_due_time_start, suggested_due_time_end, suggested_assignment_mode, suggested_value_model, suggested_amount_cents, suggested_photo_required, suggested_approval_required, active, created_at",
    )
    .eq("active", true)
    .order("category", { ascending: true })
    .order("display_order", { ascending: true });

  if (presetError) {
    throw new Error(presetError.message);
  }

  const children = childProfiles.map((childProfile) => {
    const childUser = childUsers?.find((user) => user.id === childProfile.user_id);
    return {
      id: childProfile.id,
      name: childUser?.display_name ?? "Child",
    };
  });
  const today = new Date().toISOString().slice(0, 10);
  const hasDraft = paramString(params.draft) === "1";
  const selectedPreset = presets?.find((preset) => preset.id === paramString(params.preset)) ?? null;
  const selectedWeeklyWeekdays = new Set(
    selectedPreset?.suggested_weekly_weekdays?.map((weekday) => String(weekday)) ?? [],
  );
  const presetAmountDollars = selectedPreset
    ? dollarsFromCents(selectedPreset.suggested_amount_cents)
    : "";
  const defaultValueModel =
    selectedPreset?.suggested_value_model === "fixed" && !moneyFeaturesEnabled
      ? "unpaid"
      : (selectedPreset?.suggested_value_model ?? defaultHouseholdValueModel);
  const defaultScheduleType = selectedPreset?.suggested_schedule_type ?? "one_off";
  const defaultOneOffDate =
    selectedPreset?.suggested_schedule_type === "one_off" || !selectedPreset ? today : "";
  const defaultAssignmentMode = selectedPreset?.suggested_assignment_mode ?? "selected_children";
  const defaultPhotoRequired = selectedPreset?.suggested_photo_required ?? true;
  const defaultApprovalRequired = selectedPreset?.suggested_approval_required ?? true;
  const draftValueModel = paramEnum(params.valueModel, valueModels, defaultValueModel);
  const formDefaults = {
    amountDollars: hasDraft ? (paramString(params.amountDollars) ?? "") : presetAmountDollars,
    approvalRequired: hasDraft
      ? paramBoolean(params.approvalRequired, defaultApprovalRequired)
      : defaultApprovalRequired,
    assignmentMode: hasDraft
      ? paramEnum(params.assignmentMode, assignmentModes, defaultAssignmentMode)
      : defaultAssignmentMode,
    checklistItems: hasDraft ? paramStringArray(params.checklistItems) : [],
    description: hasDraft ? (paramString(params.description) ?? "") : (selectedPreset?.description ?? ""),
    dueTimeEnd: hasDraft ? (paramString(params.dueTimeEnd) ?? "") : (selectedPreset?.suggested_due_time_end ?? ""),
    dueTimeStart: hasDraft
      ? (paramString(params.dueTimeStart) ?? "")
      : (selectedPreset?.suggested_due_time_start ?? ""),
    intervalDays: hasDraft
      ? paramNumber(params.intervalDays, selectedPreset?.suggested_interval_days ?? null)
      : (selectedPreset?.suggested_interval_days ?? null),
    oneOffDate: hasDraft ? (paramString(params.oneOffDate) ?? defaultOneOffDate) : defaultOneOffDate,
    photoRequired: hasDraft ? paramBoolean(params.photoRequired, defaultPhotoRequired) : defaultPhotoRequired,
    rotationCadence: hasDraft ? paramEnum(params.rotationCadence, rotationCadences, "weekly") : "weekly",
    rotationChildScope: hasDraft
      ? paramEnum(params.rotationChildScope, rotationChildScopes, "all_children")
      : "all_children",
    rotationStartChildProfileId: hasDraft ? (paramString(params.rotationStartChildProfileId) ?? null) : null,
    scheduleType: hasDraft ? paramEnum(params.scheduleType, scheduleTypes, defaultScheduleType) : defaultScheduleType,
    selectedChildProfileIds: hasDraft ? paramStringArray(params.selectedChildProfileIds) : [],
    startDate: hasDraft ? (paramString(params.startDate) ?? today) : today,
    title: hasDraft ? (paramString(params.title) ?? "") : (selectedPreset?.title ?? ""),
    valueModel: draftValueModel === "fixed" && !moneyFeaturesEnabled ? "unpaid" : draftValueModel,
    weeklyWeekdays: hasDraft ? paramStringArray(params.weeklyWeekdays) : [...selectedWeeklyWeekdays],
  };
  const presetsByCategory = presetCategories
    .map((category) => ({
      ...category,
      presets:
        presets?.filter((preset): preset is ChorePreset => preset.category === category.value) ?? [],
    }))
    .filter((category) => category.presets.length > 0);

  return (
    <AppShell variant="web">
        <header className="grid gap-4">
          <ParentNav />
          <div className="grid gap-2">
            <a className="w-fit text-base font-semibold text-[var(--accent-strong)]" href="/parent/chores">
              Back to Chores
            </a>
            <h1 className="text-3xl font-semibold leading-tight">
              {selectedPreset ? `Create from ${selectedPreset.title}` : "Create custom chore"}
            </h1>
            <p className="max-w-xl text-lg text-[var(--muted)]">
              {selectedPreset
                ? "Review the starter defaults, adjust what your household needs, then save it as a chore."
                : "Create a recurring chore or a chore for a specific date."}
            </p>
          </div>
        </header>

        {params.error ? (
          <p className="rounded-2xl border border-[var(--danger)] bg-[var(--surface-elevated)] p-4 text-lg font-medium text-[var(--danger)]">
            {paramString(params.error)}
          </p>
        ) : null}

        {children.length ? (
          <div className="grid gap-6">
            {selectedPreset ? (
              <section
                aria-label="Selected starter chore"
                className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <p className="text-sm font-semibold uppercase text-[var(--subtle)]">
                      Starter chore
                    </p>
                    <h2 className="text-xl font-semibold">{selectedPreset.title}</h2>
                    {selectedPreset.description ? (
                      <p className="max-w-2xl text-base text-[var(--muted)]">
                        {selectedPreset.description}
                      </p>
                    ) : null}
                  </div>
                  <a
                    className="inline-flex min-h-10 items-center rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-3 py-2 text-base font-semibold text-[var(--accent-strong)]"
                    href="/parent/chores/new"
                  >
                    Start from scratch
                  </a>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[scheduleTypeLabel(selectedPreset.suggested_schedule_type), presetValueLabel(selectedPreset, moneyFeaturesEnabled)].map(
                    (item) => (
                      <span
                        className="inline-flex min-h-8 items-center rounded-xl border border-[var(--line)] px-2 py-1 text-sm font-semibold leading-none text-[var(--accent-strong)]"
                        key={item}
                      >
                        {item}
                      </span>
                    ),
                  )}
                </div>
              </section>
            ) : null}

            <form action={createChoreTemplateAction} className="grid max-w-2xl gap-6">
              <input name="presetId" type="hidden" value={selectedPreset?.id ?? ""} />
              <ChoreTemplateFormFields
                children={children}
                defaults={formDefaults}
                moneyFeaturesEnabled={moneyFeaturesEnabled}
                submitLabel="Create chore"
              />
            </form>

            {presetsByCategory.length ? (
              <StarterChoreChooser
                moneyFeaturesEnabled={moneyFeaturesEnabled}
                presetsByCategory={presetsByCategory}
                selectedPresetId={selectedPreset?.id}
              />
            ) : null}
          </div>
        ) : (
          <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 text-lg text-[var(--muted)]">
            Add a child before creating chores.
          </p>
        )}
    </AppShell>
  );
}

function StarterChoreChooser({
  moneyFeaturesEnabled,
  presetsByCategory,
  selectedPresetId,
}: {
  moneyFeaturesEnabled: boolean;
  presetsByCategory: Array<{
    label: string;
    presets: ChorePreset[];
    value: Database["public"]["Enums"]["chore_template_preset_category"];
  }>;
  selectedPresetId?: string;
}) {
  return (
    <details className="grid rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4">
      <summary className="cursor-pointer text-lg font-semibold">
        {selectedPresetId ? "Change starter chore" : "Use a starter chore"}
      </summary>
      <div className="mt-4 grid gap-4">
        <p className="text-base text-[var(--muted)]">
          Starter chores create a draft with suggested defaults. Your current edits are not saved until you press Create chore.
        </p>
        {presetsByCategory.map((category) => (
          <details
            className="grid rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4"
            key={category.value}
            open={category.presets.some((preset) => preset.id === selectedPresetId)}
          >
            <summary className="cursor-pointer text-lg font-semibold">
              {category.label} ({category.presets.length})
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {category.presets.map((preset) => (
                <a
                  className={`grid gap-2 rounded-2xl border p-4 ${
                    preset.id === selectedPresetId
                      ? "border-[var(--accent-strong)] bg-white/8"
                      : "border-[var(--line)] bg-[var(--surface-elevated)]"
                  }`}
                  href={`/parent/chores/new?preset=${preset.id}`}
                  key={preset.id}
                >
                  <h3 className="text-lg font-semibold">{preset.title}</h3>
                  {preset.description ? (
                    <p className="text-base text-[var(--muted)]">{preset.description}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {[scheduleTypeLabel(preset.suggested_schedule_type), presetValueLabel(preset, moneyFeaturesEnabled)].map(
                      (item) => (
                        <span
                          className="inline-flex min-h-8 items-center rounded-xl border border-[var(--line)] px-2 py-1 text-sm font-semibold leading-none text-[var(--accent-strong)]"
                          key={item}
                        >
                          {item}
                        </span>
                      ),
                    )}
                  </div>
                </a>
              ))}
            </div>
          </details>
        ))}
      </div>
    </details>
  );
}
