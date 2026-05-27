import Link from "next/link";
import { claimChoreAction, submitChoreAction } from "@/app/kid/actions";
import { SignOutButton } from "@/components/sign-out-button";
import { buildDateGroupedSections } from "@/domain/kid-home";
import { requireCurrentProfile } from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ChoreInstance = Database["public"]["Tables"]["chore_instances"]["Row"];
type ChoreTemplate = Pick<
  Database["public"]["Tables"]["chore_templates"]["Row"],
  "id" | "title" | "description"
>;
type Household = Pick<
  Database["public"]["Tables"]["households"]["Row"],
  "id" | "name" | "money_features_enabled"
>;

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function statusLabel(instance: ChoreInstance) {
  if (instance.status === "available") {
    return "Available";
  }

  if (instance.status === "submitted") {
    return "Waiting for approval";
  }

  if (instance.status === "rejected") {
    return "Needs another try";
  }

  if (instance.status === "approved") {
    return "Approved";
  }

  return "Ready to submit";
}

function dueLabel(instance: ChoreInstance) {
  if (instance.due_window_end) {
    return `Due ${new Date(instance.due_window_end).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  return `Due ${instance.occurrence_date}`;
}

function currentDateString() {
  return new Date().toISOString().slice(0, 10);
}

function ChoreSubmitCard({
  household,
  instance,
  moneyFeaturesEnabled,
  template,
}: {
  household?: Household;
  instance: ChoreInstance;
  moneyFeaturesEnabled: boolean;
  template?: ChoreTemplate;
}) {
  return (
    <article className="grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="grid gap-1">
        <h3 className="text-xl font-semibold leading-snug">{template?.title ?? "Chore"}</h3>
        {template?.description ? (
          <p className="text-base text-[var(--muted)]">{template.description}</p>
        ) : null}
        <p className="text-base text-[var(--muted)]">{dueLabel(instance)}</p>
        {household ? <p className="text-base text-[var(--muted)]">{household.name}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2 text-base font-semibold">
        <span>{statusLabel(instance)}</span>
        {moneyFeaturesEnabled && instance.value_model_snapshot === "fixed" ? (
          <span>{formatMoney(instance.amount_cents_snapshot)}</span>
        ) : null}
        {instance.photo_required_snapshot ? <span>Photo required</span> : null}
      </div>
      <form action={submitChoreAction} className="grid gap-3">
        <input name="instanceId" type="hidden" value={instance.id} />
        <label className="grid gap-2 text-base font-semibold">
          Note
          <textarea
            className="min-h-24 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
            maxLength={500}
            name="note"
          />
        </label>
        {instance.photo_required_snapshot ? (
          <label className="grid gap-2 text-base font-semibold">
            Photo proof
            <input
              className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
              name="photoStoragePath"
              placeholder="Photo proof placeholder"
              required
              type="text"
            />
          </label>
        ) : null}
        <button className="min-h-12 rounded-lg bg-[var(--accent)] px-4 py-3 text-lg font-semibold text-white">
          Submit
        </button>
      </form>
    </article>
  );
}

function ChoreClaimCard({
  household,
  instance,
  template,
}: {
  household?: Household;
  instance: ChoreInstance;
  template?: ChoreTemplate;
}) {
  return (
    <article className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="grid gap-1">
        <h3 className="text-xl font-semibold leading-snug">{template?.title ?? "Chore"}</h3>
        {template?.description ? (
          <p className="text-base text-[var(--muted)]">{template.description}</p>
        ) : null}
        <p className="text-base text-[var(--muted)]">{dueLabel(instance)}</p>
        {household ? <p className="text-base text-[var(--muted)]">{household.name}</p> : null}
      </div>
      <form action={claimChoreAction}>
        <input name="instanceId" type="hidden" value={instance.id} />
        <button className="min-h-12 rounded-lg bg-[var(--accent)] px-4 py-3 text-lg font-semibold text-white">
          Claim
        </button>
      </form>
    </article>
  );
}

export default async function KidHomePage({
  searchParams,
}: {
  searchParams: Promise<{ claimed?: string; error?: string; submitted?: string }>;
}) {
  const [profile, params] = await Promise.all([requireCurrentProfile(), searchParams]);
  const supabase = await createSupabaseServerClient();

  const { data: childProfile, error: childProfileError } = await supabase
    .from("child_profiles")
    .select("id, user_id")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (childProfileError) {
    throw new Error(childProfileError.message);
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("household_memberships")
    .select("household_id")
    .eq("user_id", profile.id)
    .eq("role", "child");

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const householdIds = memberships?.map((membership) => membership.household_id) ?? [];
  const { data: households, error: householdError } = householdIds.length
    ? await supabase.from("households").select("id, name, money_features_enabled").in("id", householdIds)
    : { data: [], error: null };

  if (householdError) {
    throw new Error(householdError.message);
  }

  const moneyFeaturesEnabled = households?.some((household) => household.money_features_enabled) ?? false;
  const { data: instances, error: instanceError } =
    childProfile && householdIds.length
      ? await supabase
          .from("chore_instances")
          .select(
            "id, template_id, earning_household_id, assigned_child_profile_id, occurrence_date, due_window_start, due_window_end, value_model_snapshot, amount_cents_snapshot, photo_required_snapshot, approval_required_snapshot, status, up_for_grabs_slot, created_at, updated_at",
          )
          .in("earning_household_id", householdIds)
          .or(
            `assigned_child_profile_id.eq.${childProfile.id},and(up_for_grabs_slot.eq.true,status.eq.available)`,
          )
          .in("status", ["assigned", "available", "submitted", "rejected"])
          .order("occurrence_date", { ascending: true })
      : { data: [], error: null };

  if (instanceError) {
    throw new Error(instanceError.message);
  }

  const templateIds = [...new Set(instances?.map((instance) => instance.template_id) ?? [])];
  const { data: templates, error: templateError } = templateIds.length
    ? await supabase
        .from("chore_templates")
        .select("id, title, description")
        .in("id", templateIds)
    : { data: [], error: null };

  if (templateError) {
    throw new Error(templateError.message);
  }

  const templateById = new Map<string, ChoreTemplate>(
    templates?.map((template) => [template.id, template]) ?? [],
  );
  const householdById = new Map<string, Household>(
    households?.map((household) => [household.id, household]) ?? [],
  );
  const toDoChores =
    instances?.filter((instance) => instance.status === "assigned" || instance.status === "rejected") ??
    [];
  const toDoSections = buildDateGroupedSections(toDoChores, currentDateString());
  const waitingChores = instances?.filter((instance) => instance.status === "submitted") ?? [];
  const availableChores = instances?.filter((instance) => instance.status === "available") ?? [];
  const { data: ledgerRows, error: ledgerError } = childProfile && moneyFeaturesEnabled
    ? await supabase
        .from("ledger_transactions")
        .select("id, amount_cents, transaction_type, effective_date, created_at")
        .eq("child_profile_id", childProfile.id)
        .in("transaction_type", ["approved_credit", "manual_adjustment", "payout"])
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [], error: null };

  if (ledgerError) {
    throw new Error(ledgerError.message);
  }

  const approvedBalanceCents =
    ledgerRows?.reduce((total, ledger) => total + ledger.amount_cents, 0) ?? 0;
  const waitingValueCents = moneyFeaturesEnabled ? waitingChores.reduce(
    (total, instance) =>
      total +
      (instance.value_model_snapshot === "fixed" ? instance.amount_cents_snapshot : 0),
    0,
  ) : 0;
  const recentPaidCents =
    ledgerRows
      ?.filter((ledger) => ledger.transaction_type === "payout")
      .reduce((total, ledger) => total + Math.abs(ledger.amount_cents), 0) ?? 0;

  return (
    <main className="page-shell">
      <div className="grid gap-8 py-6">
        <header className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className="text-base font-semibold text-[var(--accent-strong)]" href="/">
              Chores
            </Link>
            <SignOutButton />
          </div>
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold leading-tight">Today</h1>
            <p className="text-lg text-[var(--muted)]">
              {profile.displayName}, here is what needs attention now.
            </p>
          </div>
        </header>

        {params.error ? (
          <p className="rounded-lg border border-[var(--danger)] bg-white p-4 text-lg font-medium text-[var(--danger)]">
            {params.error}
          </p>
        ) : null}

        {params.claimed ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
            Chore claimed.
          </p>
        ) : null}

        {params.submitted ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
            Chore submitted.
          </p>
        ) : null}

        {!childProfile ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg text-[var(--muted)]">
            Accept a household invite before chores can appear here.
          </p>
        ) : null}

        {childProfile && moneyFeaturesEnabled ? (
          <section aria-labelledby="money-heading" className="grid gap-3">
            <h2 id="money-heading" className="text-xl font-semibold">
              Money
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <article className="grid gap-1 rounded-lg border border-[var(--line)] bg-white p-4">
                <h3 className="text-base font-semibold text-[var(--muted)]">Approved</h3>
                <p className="text-2xl font-semibold">{formatMoney(approvedBalanceCents)}</p>
              </article>
              <article className="grid gap-1 rounded-lg border border-[var(--line)] bg-white p-4">
                <h3 className="text-base font-semibold text-[var(--muted)]">Waiting</h3>
                <p className="text-2xl font-semibold">{formatMoney(waitingValueCents)}</p>
              </article>
              <article className="grid gap-1 rounded-lg border border-[var(--line)] bg-white p-4">
                <h3 className="text-base font-semibold text-[var(--muted)]">Paid</h3>
                <p className="text-2xl font-semibold">{formatMoney(recentPaidCents)}</p>
              </article>
            </div>
          </section>
        ) : null}

        {toDoChores.length ? (
          toDoSections.map((section) =>
            section.items.length ? (
              <section aria-labelledby={`${section.id}-heading`} className="grid gap-3" key={section.id}>
                <div className="grid gap-1">
                  <h2 id={`${section.id}-heading`} className="text-xl font-semibold">
                    {section.title}
                  </h2>
                  <p className="text-base text-[var(--muted)]">{section.description}</p>
                </div>
                <div className="grid gap-3">
                  {section.items.map((instance) => (
                    <ChoreSubmitCard
                      household={householdById.get(instance.earning_household_id)}
                      instance={instance}
                      key={instance.id}
                      moneyFeaturesEnabled={moneyFeaturesEnabled}
                      template={templateById.get(instance.template_id)}
                    />
                  ))}
                </div>
              </section>
            ) : null,
          )
        ) : (
          <section aria-labelledby="today-heading" className="grid gap-3">
            <h2 id="today-heading" className="text-xl font-semibold">
              Today
            </h2>
            <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg text-[var(--muted)]">
              No chores are ready to submit.
            </p>
          </section>
        )}

        {availableChores.length ? (
          <section aria-labelledby="available-heading" className="grid gap-3">
            <h2 id="available-heading" className="text-xl font-semibold">
              Available
            </h2>
            <div className="grid gap-3">
              {availableChores.map((instance) => {
                const template = templateById.get(instance.template_id);

                return (
                  <ChoreClaimCard
                    household={householdById.get(instance.earning_household_id)}
                    instance={instance}
                    key={instance.id}
                    template={template}
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        {waitingChores.length ? (
          <section aria-labelledby="waiting-heading" className="grid gap-3">
            <h2 id="waiting-heading" className="text-xl font-semibold">
              Waiting
            </h2>
            <div className="grid gap-3">
              {waitingChores.map((instance) => {
                const template = templateById.get(instance.template_id);

                return (
                  <article
                    className="grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4"
                    key={instance.id}
                  >
                    <h3 className="text-xl font-semibold leading-snug">
                      {template?.title ?? "Chore"}
                    </h3>
                    <p className="text-lg font-medium">{statusLabel(instance)}</p>
                    {householdById.get(instance.earning_household_id) ? (
                      <p className="text-base text-[var(--muted)]">
                        {householdById.get(instance.earning_household_id)?.name}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
