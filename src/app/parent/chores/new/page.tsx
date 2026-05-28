import { redirect } from "next/navigation";
import { createChoreTemplateAction } from "@/app/parent/chores/new/actions";
import { ChoreTemplateFormFields } from "@/components/chore-template-form-fields";
import { ParentNav } from "@/components/parent-nav";
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

function dollarsFromCents(cents: number) {
  return cents > 0 ? (cents / 100).toFixed(2) : "";
}

export default async function NewChorePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; preset?: string }>;
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
    .select("id, money_features_enabled")
    .eq("id", householdId)
    .maybeSingle();

  if (householdError) {
    throw new Error(householdError.message);
  }

  const moneyFeaturesEnabled = household?.money_features_enabled ?? false;
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
  const selectedPreset = presets?.find((preset) => preset.id === params.preset) ?? null;
  const selectedWeeklyWeekdays = new Set(
    selectedPreset?.suggested_weekly_weekdays?.map((weekday) => String(weekday)) ?? [],
  );
  const presetAmountDollars = selectedPreset
    ? dollarsFromCents(selectedPreset.suggested_amount_cents)
    : "";
  const defaultValueModel =
    selectedPreset?.suggested_value_model === "fixed" && !moneyFeaturesEnabled
      ? "unpaid"
      : (selectedPreset?.suggested_value_model ?? (moneyFeaturesEnabled ? "fixed" : "unpaid"));
  const defaultScheduleType = selectedPreset?.suggested_schedule_type ?? "one_off";
  const defaultOneOffDate =
    selectedPreset?.suggested_schedule_type === "one_off" || !selectedPreset ? today : "";
  const presetsByCategory = presetCategories
    .map((category) => ({
      ...category,
      presets:
        presets?.filter((preset): preset is ChorePreset => preset.category === category.value) ?? [],
    }))
    .filter((category) => category.presets.length > 0);

  return (
    <main className="page-shell">
      <div className="grid gap-8 py-6">
        <header className="grid gap-4">
          <ParentNav />
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold leading-tight">Add chore</h1>
            <p className="max-w-xl text-lg text-[var(--muted)]">
              Create a reusable chore template. One-off chores appear for kids immediately.
            </p>
          </div>
        </header>

        {params.error ? (
          <p className="rounded-lg border border-[var(--danger)] bg-white p-4 text-lg font-medium text-[var(--danger)]">
            {params.error}
          </p>
        ) : null}

        {children.length ? (
          <div className="grid gap-6">
            {presetsByCategory.length ? (
              <section className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">Common chores</h2>
                  {selectedPreset ? (
                    <a
                      className="text-base font-semibold text-[var(--accent-strong)]"
                      href="/parent/chores/new"
                    >
                      Start from scratch
                    </a>
                  ) : null}
                </div>
                <div className="grid gap-3">
                  {presetsByCategory.map((category) => (
                    <details
                      className="grid rounded-lg border border-[var(--line)] bg-white p-4"
                      key={category.value}
                      open={category.presets.some((preset) => preset.id === selectedPreset?.id)}
                    >
                      <summary className="cursor-pointer text-lg font-semibold">
                        {category.label}
                      </summary>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {category.presets.map((preset) => (
                          <a
                            className={`grid gap-2 rounded-lg border p-4 ${
                              preset.id === selectedPreset?.id
                                ? "border-[var(--accent)] bg-[var(--background)]"
                                : "border-[var(--line)] bg-white"
                            }`}
                            href={`/parent/chores/new?preset=${preset.id}`}
                            key={preset.id}
                          >
                            <h3 className="text-lg font-semibold">{preset.title}</h3>
                            <p className="text-base text-[var(--muted)]">
                              {preset.description}
                            </p>
                            <p className="text-base font-semibold text-[var(--accent-strong)]">
                              {preset.suggested_value_model === "fixed"
                                ? moneyFeaturesEnabled
                                  ? `$${dollarsFromCents(preset.suggested_amount_cents)}`
                                  : "Unpaid in chores-only mode"
                                : preset.suggested_value_model === "allowance_included"
                                  ? "Allowance included"
                                  : "Unpaid"}
                            </p>
                          </a>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            ) : null}

            <form action={createChoreTemplateAction} className="grid max-w-2xl gap-6">
              <ChoreTemplateFormFields
                children={children}
                defaults={{
                  amountDollars: presetAmountDollars,
                  approvalRequired: selectedPreset?.suggested_approval_required ?? true,
                  assignmentMode: selectedPreset?.suggested_assignment_mode ?? "selected_children",
                  description: selectedPreset?.description ?? "",
                  dueTimeEnd: selectedPreset?.suggested_due_time_end ?? "",
                  dueTimeStart: selectedPreset?.suggested_due_time_start ?? "",
                  intervalDays: selectedPreset?.suggested_interval_days ?? null,
                  oneOffDate: defaultOneOffDate,
                  photoRequired: selectedPreset?.suggested_photo_required ?? true,
                  scheduleType: defaultScheduleType,
                  startDate: today,
                  title: selectedPreset?.title ?? "",
                  valueModel: defaultValueModel,
                  weeklyWeekdays: [...selectedWeeklyWeekdays],
                }}
                moneyFeaturesEnabled={moneyFeaturesEnabled}
                submitLabel="Create chore"
              />
            </form>
          </div>
        ) : (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg text-[var(--muted)]">
            Add a child before creating chores.
          </p>
        )}
      </div>
    </main>
  );
}
