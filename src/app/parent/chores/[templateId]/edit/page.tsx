import { redirect } from "next/navigation";
import { updateChoreTemplateAction } from "@/app/parent/chores/[templateId]/edit/actions";
import { ParentNav } from "@/components/parent-nav";
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
        .select("id, title, description, schedule_type, value_model, amount_cents, active")
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
    redirect("/parent?error=That chore template could not be found.");
  }

  const moneyFeaturesEnabled = household?.money_features_enabled ?? false;
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
