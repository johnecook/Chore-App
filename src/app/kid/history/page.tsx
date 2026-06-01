import { redirect } from "next/navigation";
import {
  AppScreen,
  BottomTabBar,
  HeaderGreeting,
  SectionHeader,
  TaskRow,
} from "@/components/rhythm-child-today-static";
import { requireCurrentProfile } from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ChoreStatus = Database["public"]["Enums"]["chore_instance_status"];

function statusLabel(status: ChoreStatus, paid: boolean) {
  if (paid) {
    return "Paid";
  }

  switch (status) {
    case "assigned":
      return "Ready";
    case "available":
      return "Available";
    case "submitted":
      return "Waiting";
    case "approved":
      return "Approved";
    case "rejected":
      return "Needs another try";
    case "expired":
      return "Missed";
  }
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(`${date}T00:00:00`));
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

export default async function KidHistoryPage() {
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

  const { data: historyInstances, error: historyError } = await supabase
    .from("chore_instances")
    .select(
      "id, template_id, status, occurrence_date, updated_at, value_model_snapshot, amount_cents_snapshot",
    )
    .eq("assigned_child_profile_id", childProfile.id)
    .in("status", ["submitted", "approved", "rejected", "expired"])
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
        .eq("child_profile_id", childProfile.id)
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
        .eq("child_profile_id", childProfile.id)
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

  return (
    <AppScreen>
      <div>
        <HeaderGreeting initial={profile.displayName.slice(0, 1).toUpperCase()} name="History" />
        <div className="grid gap-5 px-5 pb-5">

        <section aria-labelledby="kid-history-heading" className="grid gap-2">
          <SectionHeader title="Recent chores" />
          {historyInstances?.length ? (
            <div className="rounded-[20px] bg-[linear-gradient(145deg,rgba(43,59,120,0.96),rgba(11,36,88,0.96))] px-3 py-1 shadow-[0_16px_34px_rgba(2,7,28,0.22)]">
              {historyInstances.map((instance) => {
                const latestSubmission = latestSubmissionByInstanceId.get(instance.id);
                const latestApprovalEvent = latestApprovalEventByInstanceId.get(instance.id);
                const paid = paidInstanceIds.has(instance.id);

                return (
                  <TaskRow
                    amount={
                      instance.value_model_snapshot === "fixed"
                        ? formatMoney(instance.amount_cents_snapshot)
                        : statusLabel(instance.status, paid)
                    }
                    done={paid || instance.status === "approved"}
                    icon={paid || instance.status === "approved" ? "✓" : instance.status === "rejected" ? "↺" : "≡"}
                    key={instance.id}
                    meta={formatDate(instance.occurrence_date)}
                    statusLabel={statusLabel(instance.status, paid)}
                    title={templateTitleById.get(instance.template_id) ?? "Chore"}
                  >
                    {latestSubmission?.note ? (
                      <p className="text-base">Your note: {latestSubmission.note}</p>
                    ) : null}
                    {latestApprovalEvent?.feedback ? (
                      <p className="text-base">Parent note: {latestApprovalEvent.feedback}</p>
                    ) : null}
                  </TaskRow>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[20px] bg-[linear-gradient(145deg,rgba(43,59,120,0.96),rgba(11,36,88,0.96))] p-4">
              <p className="text-lg font-bold text-white">No submitted chores yet.</p>
            </div>
          )}
        </section>
        </div>
      </div>
      <BottomTabBar active="History" />
    </AppScreen>
  );
}
