import Link from "next/link";
import { redirect } from "next/navigation";
import { closeOutPayoutAction, createManualAdjustmentAction } from "@/app/parent/actions";
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

function currentDateString() {
  return new Date().toISOString().slice(0, 10);
}

export default async function ParentMoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ adjusted?: string }>;
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
  const today = currentDateString();
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
          "id, child_profile_id, pay_period_id, transaction_type, amount_cents, description, effective_date, created_at",
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

  const payPeriodIds = [
    ...new Set(
      ledgerRows
        ?.map((ledger) => ledger.pay_period_id)
        .filter((payPeriodId): payPeriodId is string => Boolean(payPeriodId)) ?? [],
    ),
  ];
  const { data: payPeriods, error: payPeriodError } = payPeriodIds.length
    ? await supabase.from("pay_periods").select("id, start_date, end_date").in("id", payPeriodIds)
    : { data: [], error: null };

  if (payPeriodError) {
    throw new Error(payPeriodError.message);
  }

  const payPeriodById = new Map(payPeriods?.map((period) => [period.id, period]) ?? []);
  const payoutRows = Array.from(
    (ledgerRows ?? []).reduce((rows, ledger) => {
      if (!ledger.pay_period_id) {
        return rows;
      }

      const key = `${ledger.child_profile_id}:${ledger.pay_period_id}`;
      const existing = rows.get(key) ?? {
        amountCents: 0,
        childProfileId: ledger.child_profile_id,
        payPeriodId: ledger.pay_period_id,
      };
      rows.set(key, {
        ...existing,
        amountCents: existing.amountCents + ledger.amount_cents,
      });
      return rows;
    }, new Map<string, { amountCents: number; childProfileId: string; payPeriodId: string }>()),
  )
    .map(([, row]) => row)
    .filter((row) => row.amountCents > 0)
    .sort((left, right) => {
      const leftPeriod = payPeriodById.get(left.payPeriodId);
      const rightPeriod = payPeriodById.get(right.payPeriodId);
      return (leftPeriod?.end_date ?? "").localeCompare(rightPeriod?.end_date ?? "");
    });

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
          {params.adjusted ? (
            <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
              Money adjustment added.
            </p>
          ) : null}

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
                  <details className="mt-3 grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--background)] p-3">
                    <summary className="cursor-pointer text-base font-semibold text-[var(--accent-strong)]">
                      Add adjustment
                    </summary>
                    <form action={createManualAdjustmentAction} className="mt-3 grid gap-3">
                      <input name="childProfileId" type="hidden" value={childProfileId} />
                      <input name="redirectTo" type="hidden" value="money" />
                      <label className="grid gap-2 text-base font-semibold">
                        Direction
                        <select
                          className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                          name="direction"
                          required
                        >
                          <option value="credit">Add money</option>
                          <option value="debit">Subtract money</option>
                        </select>
                      </label>
                      <label className="grid gap-2 text-base font-semibold">
                        Amount
                        <input
                          className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                          inputMode="decimal"
                          min="0.01"
                          name="amountDollars"
                          placeholder="5.00"
                          required
                          step="0.01"
                          type="number"
                        />
                      </label>
                      <label className="grid gap-2 text-base font-semibold">
                        Effective date
                        <input
                          className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                          defaultValue={today}
                          name="effectiveOn"
                          required
                          type="date"
                        />
                      </label>
                      <label className="grid gap-2 text-base font-semibold">
                        Note
                        <input
                          className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                          maxLength={500}
                          name="description"
                          placeholder="Allowance correction"
                          required
                          type="text"
                        />
                      </label>
                      <button className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg font-semibold text-[var(--accent-strong)]">
                        Save adjustment
                      </button>
                    </form>
                  </details>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg text-[var(--muted)]">
              Add a child before money history can appear.
            </p>
          )}
        </section>

        <section aria-labelledby="payout-heading" className="grid gap-3">
          <h2 id="payout-heading" className="text-xl font-semibold">
            Ready to pay
          </h2>
          {payoutRows.length ? (
            <div className="grid gap-3">
              {payoutRows.map((row) => {
                const period = payPeriodById.get(row.payPeriodId);

                return (
                  <article
                    className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4"
                    key={`${row.childProfileId}:${row.payPeriodId}`}
                  >
                    <div className="grid gap-1">
                      <h3 className="text-xl font-semibold leading-snug">
                        {childNameById.get(row.childProfileId) ?? "Child"}
                      </h3>
                      <p className="text-3xl font-semibold">{formatMoney(row.amountCents)}</p>
                      {period ? (
                        <p className="text-base text-[var(--muted)]">
                          {formatDate(period.start_date)} through {formatDate(period.end_date)}
                        </p>
                      ) : null}
                    </div>
                    <form action={closeOutPayoutAction} className="grid gap-3">
                      <input name="childProfileId" type="hidden" value={row.childProfileId} />
                      <input name="payPeriodId" type="hidden" value={row.payPeriodId} />
                      <label className="grid gap-2 text-base font-semibold">
                        Payout note
                        <input
                          className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                          maxLength={500}
                          name="note"
                          type="text"
                        />
                      </label>
                      <button className="min-h-12 rounded-lg bg-[var(--accent)] px-4 py-3 text-lg font-semibold text-white">
                        Mark paid
                      </button>
                    </form>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg text-[var(--muted)]">
              No approved payouts are ready.
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
