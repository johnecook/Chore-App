import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { requireCurrentProfile } from "@/lib/auth/session";
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
      return "Chore approved";
    case "manual_adjustment":
      return "Adjustment";
    case "payout":
      return "Paid out";
    case "pending_credit":
      return "Pending chore";
  }
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(`${date}T00:00:00`));
}

export default async function KidMoneyPage() {
  const profile = await requireCurrentProfile();

  if (profile.appRole !== "child") {
    redirect("/parent");
  }

  const supabase = await createSupabaseServerClient();
  const { data: childProfile, error: childProfileError } = await supabase
    .from("child_profiles")
    .select("id")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (childProfileError) {
    throw new Error(childProfileError.message);
  }

  if (!childProfile) {
    redirect("/kid");
  }

  const { data: ledgerRows, error: ledgerError } = await supabase
    .from("ledger_transactions")
    .select("id, transaction_type, amount_cents, description, effective_date, created_at")
    .eq("child_profile_id", childProfile.id)
    .in("transaction_type", ["approved_credit", "manual_adjustment", "payout"])
    .order("created_at", { ascending: false })
    .limit(100);

  if (ledgerError) {
    throw new Error(ledgerError.message);
  }

  const approvedBalanceCents =
    ledgerRows?.reduce((total, ledger) => total + ledger.amount_cents, 0) ?? 0;
  const paidCents =
    ledgerRows
      ?.filter((ledger) => ledger.transaction_type === "payout")
      .reduce((total, ledger) => total + Math.abs(ledger.amount_cents), 0) ?? 0;

  return (
    <main className="page-shell">
      <div className="grid gap-8 py-6">
        <header className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className="text-base font-semibold text-[var(--accent-strong)]" href="/kid">
              Chores
            </Link>
            <SignOutButton />
          </div>
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold leading-tight">Money history</h1>
            <p className="text-lg text-[var(--muted)]">
              Review approved chore money, adjustments, and payouts.
            </p>
          </div>
        </header>

        <section aria-labelledby="money-summary-heading" className="grid gap-3">
          <h2 id="money-summary-heading" className="text-xl font-semibold">
            Summary
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="grid gap-1 rounded-lg border border-[var(--line)] bg-white p-4">
              <h3 className="text-base font-semibold text-[var(--muted)]">Available</h3>
              <p className="text-3xl font-semibold">{formatMoney(approvedBalanceCents)}</p>
            </article>
            <article className="grid gap-1 rounded-lg border border-[var(--line)] bg-white p-4">
              <h3 className="text-base font-semibold text-[var(--muted)]">Paid</h3>
              <p className="text-3xl font-semibold">{formatMoney(paidCents)}</p>
            </article>
          </div>
        </section>

        <section aria-labelledby="transactions-heading" className="grid gap-3">
          <h2 id="transactions-heading" className="text-xl font-semibold">
            Transactions
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
                      {transactionLabel(ledger.transaction_type)}
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
                  <p className="text-base text-[var(--muted)]">{formatDate(ledger.effective_date)}</p>
                  {ledger.description ? <p className="text-base">{ledger.description}</p> : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg text-[var(--muted)]">
              No money activity yet.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
