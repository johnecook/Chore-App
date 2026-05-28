import Link from "next/link";
import { redirect } from "next/navigation";
import { ParentNav } from "@/components/parent-nav";
import { getCurrentParentHouseholdId, requireCurrentProfile } from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type LedgerType = Database["public"]["Enums"]["ledger_transaction_type"];

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

function transactionLabel(type: LedgerType) {
  switch (type) {
    case "approved_credit":
      return "Approved chore";
    case "manual_adjustment":
      return "Adjustment";
    case "payout":
      return "Payout";
    case "pending_credit":
      return "Pending chore";
  }
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(`${date}T00:00:00`));
}

export default async function ParentMoneyPage() {
  const [profile, householdId] = await Promise.all([
    requireCurrentProfile(),
    getCurrentParentHouseholdId(),
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

  if (!household?.money_features_enabled) {
    return (
      <main className="page-shell">
        <div className="grid gap-8 py-6">
          <header className="grid gap-4">
            <ParentNav />
            <div className="grid gap-2">
              <h1 className="text-3xl font-semibold leading-tight">Money</h1>
              <p className="text-lg text-[var(--muted)]">
                Money features are off for this household.
              </p>
            </div>
          </header>
          <Link
            className="min-h-12 rounded-lg bg-[var(--accent)] px-5 py-3 text-center text-lg font-semibold text-white"
            href="/parent/household"
          >
            Open household settings
          </Link>
        </div>
      </main>
    );
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
  const { data: childProfiles, error: childProfileError } = childUserIds.length
    ? await supabase.from("child_profiles").select("id, user_id").in("user_id", childUserIds)
    : { data: [], error: null };

  if (childProfileError) {
    throw new Error(childProfileError.message);
  }

  const { data: childUsers, error: childUserError } = childUserIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", childUserIds)
    : { data: [], error: null };

  if (childUserError) {
    throw new Error(childUserError.message);
  }

  const childNameById = new Map(
    childProfiles.map((childProfile) => {
      const childUser = childUsers?.find((user) => user.id === childProfile.user_id);
      return [childProfile.id, childUser?.display_name ?? "Child"] as const;
    }),
  );
  const childProfileIds = childProfiles.map((childProfile) => childProfile.id);
  const { data: ledgerRows, error: ledgerError } = childProfileIds.length
    ? await supabase
        .from("ledger_transactions")
        .select(
          "id, child_profile_id, transaction_type, amount_cents, description, effective_date, created_at",
        )
        .eq("payout_household_id", householdId)
        .in("child_profile_id", childProfileIds)
        .in("transaction_type", ["approved_credit", "manual_adjustment", "payout"])
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [], error: null };

  if (ledgerError) {
    throw new Error(ledgerError.message);
  }

  const balancesByChildId = new Map<string, number>(
    childProfileIds.map((childProfileId) => [childProfileId, 0] as const),
  );

  for (const ledger of ledgerRows ?? []) {
    balancesByChildId.set(
      ledger.child_profile_id,
      (balancesByChildId.get(ledger.child_profile_id) ?? 0) + ledger.amount_cents,
    );
  }

  return (
    <main className="page-shell">
      <div className="grid gap-8 py-6">
        <header className="grid gap-4">
          <ParentNav />
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold leading-tight">Money</h1>
            <p className="text-lg text-[var(--muted)]">
              Review approved balances, adjustments, and payout history.
            </p>
          </div>
        </header>

        <section aria-labelledby="balances-heading" className="grid gap-3">
          <h2 id="balances-heading" className="text-xl font-semibold">
            Balances
          </h2>
          {childProfileIds.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {childProfileIds.map((childProfileId) => (
                <article
                  className="grid gap-1 rounded-lg border border-[var(--line)] bg-white p-4"
                  key={childProfileId}
                >
                  <h3 className="text-xl font-semibold leading-snug">
                    {childNameById.get(childProfileId) ?? "Child"}
                  </h3>
                  <p className="text-3xl font-semibold">
                    {formatMoney(balancesByChildId.get(childProfileId) ?? 0)}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg text-[var(--muted)]">
              Add a child before money history can appear.
            </p>
          )}
        </section>

        <section aria-labelledby="ledger-heading" className="grid gap-3">
          <h2 id="ledger-heading" className="text-xl font-semibold">
            Ledger
          </h2>
          {ledgerRows?.length ? (
            <div className="grid gap-3">
              {ledgerRows.map((ledger) => (
                <article
                  className="grid gap-1 rounded-lg border border-[var(--line)] bg-white p-4"
                  key={ledger.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold">
                      {childNameById.get(ledger.child_profile_id) ?? "Child"}
                    </h3>
                    <p
                      className={`text-lg font-semibold ${
                        ledger.amount_cents < 0 ? "text-[var(--danger)]" : "text-[var(--accent-strong)]"
                      }`}
                    >
                      {ledger.amount_cents > 0 ? "+" : ""}
                      {formatMoney(ledger.amount_cents)}
                    </p>
                  </div>
                  <p className="text-base text-[var(--muted)]">
                    {transactionLabel(ledger.transaction_type)} • {formatDate(ledger.effective_date)}
                  </p>
                  {ledger.description ? <p className="text-base">{ledger.description}</p> : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg text-[var(--muted)]">
              No ledger activity yet.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
