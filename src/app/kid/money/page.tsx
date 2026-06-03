import { redirect } from "next/navigation";
import {
  AppScreen,
  BottomTabBar,
  HeaderGreeting,
  SectionHeader,
  SegmentedControl,
  TaskRow,
} from "@/components/rhythm-child-today-static";
import { requireCurrentProfile } from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type LedgerType = Database["public"]["Enums"]["ledger_transaction_type"];

function transactionLabel(type: LedgerType) {
  switch (type) {
    case "allowance_credit":
      return "Base allowance";
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

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
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
    .in("transaction_type", ["allowance_credit", "approved_credit", "manual_adjustment", "payout"])
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
    <AppScreen>
      <div>
        <HeaderGreeting initial={profile.displayName.slice(0, 1).toUpperCase()} name="Finances" />
        <div className="grid gap-5 px-5 pb-5">
        <SegmentedControl
          items={[
            { label: "Wallet", selected: true },
            { label: "Earnings" },
            { label: "Spending" },
            { label: "Giving" },
          ]}
        />

        <section aria-labelledby="money-summary-heading" className="grid gap-3">
          <SectionHeader title="Wallet" />
            <div className="rounded-[18px] bg-[linear-gradient(135deg,#263AA4,#0B5C93)] p-4 shadow-[0_16px_34px_rgba(2,7,28,0.28)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white">Current balance</h3>
                  <p className="mt-1 text-[40px] font-bold leading-none text-white">
                    {formatMoney(approvedBalanceCents)}
                  </p>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#AEEBF2] text-3xl font-bold text-[#071743]">
                  $
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
                <div>
                  <p className="text-sm text-white/70">Paid</p>
                  <p className="text-xl font-bold text-white">{formatMoney(paidCents)}</p>
                </div>
                <div>
                  <p className="text-sm text-white/70">Available</p>
                  <p className="text-xl font-bold text-white">{formatMoney(approvedBalanceCents)}</p>
                </div>
              </div>
            </div>
        </section>

        <section aria-labelledby="transactions-heading" className="grid gap-2">
          <SectionHeader action="View all" title="Recent transactions" />
          {ledgerRows?.length ? (
            <div className="rounded-[20px] bg-[linear-gradient(145deg,rgba(43,59,120,0.96),rgba(11,36,88,0.96))] px-3 py-1 shadow-[0_16px_34px_rgba(2,7,28,0.22)]">
              {ledgerRows.map((ledger) => (
                <TaskRow
                  amount={`${ledger.amount_cents > 0 ? "+" : ""}${formatMoney(ledger.amount_cents)}`}
                  icon={ledger.amount_cents < 0 ? "-" : "$"}
                  meta={formatDate(ledger.effective_date)}
                  title={ledger.description || transactionLabel(ledger.transaction_type)}
                  key={ledger.id}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[20px] bg-[linear-gradient(145deg,rgba(43,59,120,0.96),rgba(11,36,88,0.96))] p-4">
              <p className="text-lg font-bold text-white">No money activity yet.</p>
            </div>
          )}
        </section>
        </div>
      </div>
      <BottomTabBar active="Money" />
    </AppScreen>
  );
}
