import Link from "next/link";
import { redirect } from "next/navigation";
import { reopenChoreAction } from "@/app/parent/actions";
import { ParentNav } from "@/components/parent-nav";
import { AppShell } from "@/components/ui";
import { getCurrentParentHouseholdId, requireCurrentProfile } from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type HistoryStatus = "all" | "submitted" | "approved" | "rejected" | "expired" | "paid";
type ChoreStatus = Database["public"]["Enums"]["chore_instance_status"];

const historyFilters: Array<{ label: string; status: HistoryStatus }> = [
  { label: "All", status: "all" },
  { label: "Waiting", status: "submitted" },
  { label: "Approved", status: "approved" },
  { label: "Sent back", status: "rejected" },
  { label: "Missed", status: "expired" },
  { label: "Paid", status: "paid" },
];

function normalizeHistoryStatus(value?: string): HistoryStatus {
  return historyFilters.some((filter) => filter.status === value)
    ? (value as HistoryStatus)
    : "all";
}

function statusLabel(status: ChoreStatus, paid: boolean) {
  if (paid) {
    return "Paid";
  }

  switch (status) {
    case "submitted":
      return "Waiting for approval";
    case "approved":
      return "Approved";
    case "rejected":
      return "Needs another try";
    case "expired":
      return "Missed";
    case "available":
      return "Available";
    case "assigned":
      return "Assigned";
  }
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

export default async function ParentHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
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

  const activeStatus = normalizeHistoryStatus(params.status);
  const supabase = await createSupabaseServerClient();
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
  const historyStatuses: ChoreStatus[] =
    activeStatus === "all" || activeStatus === "paid"
      ? ["submitted", "approved", "rejected", "expired"]
      : [activeStatus];
  const { data: historyInstances, error: historyError } = await supabase
    .from("chore_instances")
    .select(
      "id, template_id, assigned_child_profile_id, status, occurrence_date, updated_at, value_model_snapshot, amount_cents_snapshot",
    )
    .eq("earning_household_id", householdId)
    .in("status", historyStatuses)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (historyError) {
    throw new Error(historyError.message);
  }

  const instanceIds = historyInstances?.map((instance) => instance.id) ?? [];
  const templateIds = [
    ...new Set(historyInstances?.map((instance) => instance.template_id) ?? []),
  ];
  const { data: templates, error: templateError } = templateIds.length
    ? await supabase.from("chore_templates").select("id, title").in("id", templateIds)
    : { data: [], error: null };

  if (templateError) {
    throw new Error(templateError.message);
  }

  const { data: submissions, error: submissionError } = instanceIds.length
    ? await supabase
        .from("chore_submissions")
        .select("id, instance_id, note, attempt_number, submitted_at")
        .in("instance_id", instanceIds)
        .order("attempt_number", { ascending: false })
    : { data: [], error: null };

  if (submissionError) {
    throw new Error(submissionError.message);
  }

  const { data: approvalEvents, error: approvalError } = instanceIds.length
    ? await supabase
        .from("approval_events")
        .select("id, instance_id, event_type, feedback, created_at")
        .in("instance_id", instanceIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (approvalError) {
    throw new Error(approvalError.message);
  }

  const { data: approvedCredits, error: ledgerError } = instanceIds.length
    ? await supabase
        .from("ledger_transactions")
        .select("id, chore_instance_id, child_profile_id, pay_period_id")
        .eq("earning_household_id", householdId)
        .eq("transaction_type", "approved_credit")
        .in("chore_instance_id", instanceIds)
    : { data: [], error: null };

  if (ledgerError) {
    throw new Error(ledgerError.message);
  }

  const payPeriodIds = [
    ...new Set(
      approvedCredits
        ?.map((ledger) => ledger.pay_period_id)
        .filter((payPeriodId): payPeriodId is string => Boolean(payPeriodId)) ?? [],
    ),
  ];
  const { data: payoutEvents, error: payoutError } = payPeriodIds.length
    ? await supabase
        .from("payout_events")
        .select("id, child_profile_id, pay_period_id")
        .eq("payout_household_id", householdId)
        .in("pay_period_id", payPeriodIds)
    : { data: [], error: null };

  if (payoutError) {
    throw new Error(payoutError.message);
  }

  const templateTitleById = new Map(templates?.map((template) => [template.id, template.title]) ?? []);
  const latestSubmissionByInstanceId = new Map(
    submissions?.reduce<Array<[string, (typeof submissions)[number]]>>((rows, submission) => {
      if (!rows.some(([instanceId]) => instanceId === submission.instance_id)) {
        rows.push([submission.instance_id, submission]);
      }

      return rows;
    }, []) ?? [],
  );
  const latestApprovalEventByInstanceId = new Map(
    approvalEvents?.reduce<Array<[string, (typeof approvalEvents)[number]]>>((rows, event) => {
      if (!rows.some(([instanceId]) => instanceId === event.instance_id)) {
        rows.push([event.instance_id, event]);
      }

      return rows;
    }, []) ?? [],
  );
  const paidInstanceIds = new Set(
    approvedCredits
      ?.filter((credit) =>
        payoutEvents?.some(
          (payout) =>
            payout.child_profile_id === credit.child_profile_id &&
            payout.pay_period_id === credit.pay_period_id,
        ),
      )
      .map((credit) => credit.chore_instance_id)
      .filter((instanceId): instanceId is string => Boolean(instanceId)) ?? [],
  );
  const filteredHistoryInstances =
    activeStatus === "paid"
      ? historyInstances?.filter((instance) => paidInstanceIds.has(instance.id)) ?? []
      : historyInstances ?? [];

  return (
    <AppShell variant="web">
        <header className="grid gap-4">
          <ParentNav />
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold leading-tight">Chore history</h1>
            <p className="text-lg text-[var(--muted)]">
              Review submitted, approved, returned, missed, and paid chores.
            </p>
          </div>
        </header>

        <nav aria-label="History filters" className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          {historyFilters.map((filter) => (
            <Link
              className={`rounded-2xl border px-3 py-2 text-center text-base font-semibold ${
                activeStatus === filter.status
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--foreground)]"
              }`}
              href={filter.status === "all" ? "/parent/history" : `/parent/history?status=${filter.status}`}
              key={filter.status}
            >
              {filter.label}
            </Link>
          ))}
        </nav>

        <section aria-labelledby="history-list-heading" className="grid gap-3">
          <h2 id="history-list-heading" className="text-xl font-semibold">
            Results
          </h2>
          {filteredHistoryInstances.length ? (
            <div className="grid gap-3">
              {filteredHistoryInstances.map((instance) => {
                const latestSubmission = latestSubmissionByInstanceId.get(instance.id);
                const latestApprovalEvent = latestApprovalEventByInstanceId.get(instance.id);
                const paid = paidInstanceIds.has(instance.id);

                return (
                  <article
                    className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4"
                    key={instance.id}
                  >
                    <div className="grid gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold leading-snug">
                          {templateTitleById.get(instance.template_id) ?? "Chore"}
                        </h3>
                        <span className="rounded-xl border border-[var(--line)] px-2 py-1 text-base font-semibold text-[var(--muted)]">
                          {statusLabel(instance.status, paid)}
                        </span>
                      </div>
                      <p className="text-base text-[var(--muted)]">
                        {childNameById.get(instance.assigned_child_profile_id ?? "") ?? "Child"} •{" "}
                        {instance.occurrence_date}
                        {instance.value_model_snapshot === "fixed"
                          ? ` • ${formatMoney(instance.amount_cents_snapshot)}`
                          : ""}
                      </p>
                      {latestSubmission?.note ? (
                        <p className="text-base">Submission: {latestSubmission.note}</p>
                      ) : null}
                      {latestApprovalEvent?.feedback ? (
                        <p className="text-base">Parent note: {latestApprovalEvent.feedback}</p>
                      ) : null}
                    </div>

                    {instance.status === "rejected" || instance.status === "expired" ? (
                      <form action={reopenChoreAction} className="grid gap-3">
                        <input name="instanceId" type="hidden" value={instance.id} />
                        <label className="grid gap-2 text-base font-semibold">
                          Reopen note
                          <input
                            className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
                            maxLength={500}
                            name="feedback"
                            type="text"
                          />
                        </label>
                        <button className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg font-semibold text-[var(--accent-strong)]">
                          Reopen
                        </button>
                      </form>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 text-lg text-[var(--muted)]">
              No chores match this filter.
            </p>
          )}
        </section>
    </AppShell>
  );
}
