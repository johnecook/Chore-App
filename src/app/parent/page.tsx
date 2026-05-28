import Link from "next/link";
import { redirect } from "next/navigation";
import {
  approveSubmissionAction,
  closeOutPayoutAction,
  createManualAdjustmentAction,
  deactivateTemplateAction,
  deleteSubmissionPhotoAction,
  rejectSubmissionAction,
  reopenChoreAction,
  syncScheduleAction,
} from "@/app/parent/actions";
import { ParentNav } from "@/components/parent-nav";
import { getCurrentParentHouseholdId, requireCurrentProfile } from "@/lib/auth/session";
import { CHORE_SUBMISSION_PHOTO_BUCKET } from "@/lib/supabase/chore-photo-storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export default async function ParentHomePage({
  searchParams,
}: {
  searchParams: Promise<{
    approved?: string;
    adjusted?: string;
    createdChore?: string;
    deactivatedTemplate?: string;
    error?: string;
    paid?: string;
    photoDeleted?: string;
    rejected?: string;
    reopened?: string;
    synced?: string;
    updatedTemplate?: string;
  }>;
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

  const children = childProfiles.map((childProfile) => {
    const childUser = childUsers?.find((user) => user.id === childProfile.user_id);
    return {
      id: childProfile.id,
      name: childUser?.display_name ?? "Child",
    };
  });
  const childNameById = new Map(children.map((child) => [child.id, child.name]));

  const hasChildren = children.length > 0;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = addDays(today, 1);
  const { data: choreTemplates, error: templateError } = await supabase
    .from("chore_templates")
    .select("id, title, schedule_type, active, created_at")
    .eq("household_id", householdId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(5);

  if (templateError) {
    throw new Error(templateError.message);
  }

  const { data: remainingToday, error: remainingError } = await supabase
    .from("chore_instances")
    .select("id, template_id, assigned_child_profile_id, status, occurrence_date, up_for_grabs_slot")
    .eq("earning_household_id", householdId)
    .eq("occurrence_date", today)
    .in("status", ["assigned", "available", "rejected"])
    .order("created_at", { ascending: false })
    .limit(10);

  if (remainingError) {
    throw new Error(remainingError.message);
  }

  const { data: upcomingInstances, error: upcomingError } = await supabase
    .from("chore_instances")
    .select("id, template_id, assigned_child_profile_id, status, occurrence_date, up_for_grabs_slot")
    .eq("earning_household_id", householdId)
    .gt("occurrence_date", today)
    .lte("occurrence_date", tomorrow)
    .in("status", ["assigned", "available", "rejected"])
    .order("occurrence_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(20);

  if (upcomingError) {
    throw new Error(upcomingError.message);
  }

  const { data: waitingApproval, error: approvalError } = await supabase
    .from("chore_instances")
    .select(
      "id, template_id, assigned_child_profile_id, status, value_model_snapshot, amount_cents_snapshot, photo_required_snapshot",
    )
    .eq("earning_household_id", householdId)
    .eq("status", "submitted")
    .order("updated_at", { ascending: false })
    .limit(10);

  if (approvalError) {
    throw new Error(approvalError.message);
  }

  const { data: recentHistory, error: recentHistoryError } = await supabase
    .from("chore_instances")
    .select(
      "id, template_id, assigned_child_profile_id, status, occurrence_date, updated_at, value_model_snapshot, amount_cents_snapshot",
    )
    .eq("earning_household_id", householdId)
    .in("status", ["approved", "rejected", "expired"])
    .order("updated_at", { ascending: false })
    .limit(10);

  if (recentHistoryError) {
    throw new Error(recentHistoryError.message);
  }

  const dashboardTemplateIds = [
    ...new Set([
      ...(choreTemplates?.map((template) => template.id) ?? []),
      ...(remainingToday?.map((instance) => instance.template_id) ?? []),
      ...(upcomingInstances?.map((instance) => instance.template_id) ?? []),
      ...(waitingApproval?.map((instance) => instance.template_id) ?? []),
      ...(recentHistory?.map((instance) => instance.template_id) ?? []),
    ]),
  ];
  const { data: dashboardTemplates, error: dashboardTemplateError } = dashboardTemplateIds.length
    ? await supabase
        .from("chore_templates")
        .select("id, title")
        .in("id", dashboardTemplateIds)
    : { data: [], error: null };

  if (dashboardTemplateError) {
    throw new Error(dashboardTemplateError.message);
  }

  const templateTitleById = new Map(
    dashboardTemplates?.map((template) => [template.id, template.title]) ?? [],
  );
  const submittedInstanceIds = waitingApproval?.map((instance) => instance.id) ?? [];
  const { data: submissions, error: submissionError } = submittedInstanceIds.length
    ? await supabase
        .from("chore_submissions")
        .select(
          "id, instance_id, note, photo_storage_path, photo_deleted_at, attempt_number, submitted_at",
        )
        .in("instance_id", submittedInstanceIds)
        .order("attempt_number", { ascending: false })
    : { data: [], error: null };

  if (submissionError) {
    throw new Error(submissionError.message);
  }

  const latestSubmissionByInstanceId = new Map(
    submissions?.reduce<Array<[string, (typeof submissions)[number]]>>((rows, submission) => {
      if (!rows.some(([instanceId]) => instanceId === submission.instance_id)) {
        rows.push([submission.instance_id, submission]);
      }

      return rows;
    }, []) ?? [],
  );
  const photoSubmissions =
    submissions?.filter(
      (submission) => submission.photo_storage_path && !submission.photo_deleted_at,
    ) ?? [];
  const signedPhotoUrlBySubmissionId = new Map(
    (
      await Promise.all(
        photoSubmissions.map(async (submission) => {
          const { data } = await supabase.storage
            .from(CHORE_SUBMISSION_PHOTO_BUCKET)
            .createSignedUrl(submission.photo_storage_path ?? "", 600);

          return data?.signedUrl ? ([submission.id, data.signedUrl] as const) : null;
        }),
      )
    ).filter((row): row is readonly [string, string] => row !== null),
  );
  const { data: approvedLedger, error: approvedLedgerError } = childProfiles.length && moneyFeaturesEnabled
    ? await supabase
        .from("ledger_transactions")
        .select("id, child_profile_id, pay_period_id, amount_cents, transaction_type")
        .eq("payout_household_id", householdId)
        .in(
          "child_profile_id",
          childProfiles.map((child) => child.id),
        )
        .in("transaction_type", ["approved_credit", "manual_adjustment", "payout"])
    : { data: [], error: null };

  if (approvedLedgerError) {
    throw new Error(approvedLedgerError.message);
  }

  const payPeriodIds = [
    ...new Set(
      approvedLedger
        ?.map((ledger) => ledger.pay_period_id)
        .filter((payPeriodId): payPeriodId is string => Boolean(payPeriodId)) ?? [],
    ),
  ];
  const { data: payPeriods, error: payPeriodError } = payPeriodIds.length
    ? await supabase
        .from("pay_periods")
        .select("id, start_date, end_date")
        .in("id", payPeriodIds)
    : { data: [], error: null };

  if (payPeriodError) {
    throw new Error(payPeriodError.message);
  }

  const payPeriodById = new Map(payPeriods?.map((period) => [period.id, period]) ?? []);
  const payoutRows = Array.from(
    (approvedLedger ?? []).reduce((rows, ledger) => {
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
            <h1 className="text-3xl font-semibold leading-tight">Parent dashboard</h1>
            <p className="text-lg text-[var(--muted)]">
              {profile.displayName}, review what needs attention today.
            </p>
          </div>
        </header>

        {!hasChildren ? (
          <section className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
            <h2 className="text-xl font-semibold">Set up household members</h2>
            <p className="text-base text-[var(--muted)]">
              Add your first child before creating chore templates.
            </p>
            <Link
              className="min-h-12 rounded-lg bg-[var(--accent)] px-5 py-3 text-center text-lg font-semibold text-white"
              href="/parent/household"
            >
              Open household
            </Link>
          </section>
        ) : null}

        {params.error ? (
          <p className="rounded-lg border border-[var(--danger)] bg-white p-4 text-lg font-medium text-[var(--danger)]">
            {params.error}
          </p>
        ) : null}

        {params.createdChore ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
            Chore created.
          </p>
        ) : null}

        {params.deactivatedTemplate ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
            Chore template deactivated.
          </p>
        ) : null}

        {params.updatedTemplate ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
            Chore template updated.
          </p>
        ) : null}

        {params.approved ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
            Chore approved.
          </p>
        ) : null}

        {params.adjusted ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
            Money adjustment added.
          </p>
        ) : null}

        {params.rejected ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
            Chore sent back.
          </p>
        ) : null}

        {params.paid ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
            Payout marked paid.
          </p>
        ) : null}

        {params.photoDeleted ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
            Photo removed.
          </p>
        ) : null}

        {params.reopened ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
            Chore reopened.
          </p>
        ) : null}

        {params.synced ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
            Chore schedule synced.
          </p>
        ) : null}

        {hasChildren ? (
          <>
            {moneyFeaturesEnabled ? (
              <details className="grid rounded-lg border border-[var(--line)] bg-white p-4" open>
                <summary className="cursor-pointer text-xl font-semibold">Money</summary>
                <div className="mt-4 grid gap-6">
                  <section className="grid gap-3">
                    <h2 className="text-lg font-semibold">Ready to pay</h2>
                    {payoutRows.length ? (
                      <div className="grid gap-3">
                        {payoutRows.map((row) => {
                          const period = payPeriodById.get(row.payPeriodId);

                      return (
                        <article
                          className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--background)] p-4"
                          key={`${row.childProfileId}:${row.payPeriodId}`}
                        >
                          <div className="grid gap-1">
                            <h3 className="text-lg font-semibold">
                              {childNameById.get(row.childProfileId) ?? "Child"}
                            </h3>
                            <p className="text-2xl font-semibold">
                              ${(row.amountCents / 100).toFixed(2)}
                            </p>
                            {period ? (
                              <p className="text-base text-[var(--muted)]">
                                {period.start_date} through {period.end_date}
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
                          <details className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-3">
                            <summary className="cursor-pointer text-base font-semibold text-[var(--accent-strong)]">
                              Add adjustment
                            </summary>
                            <form action={createManualAdjustmentAction} className="mt-3 grid gap-3">
                              <input name="childProfileId" type="hidden" value={row.childProfileId} />
                              <input name="payPeriodId" type="hidden" value={row.payPeriodId} />
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
                      );
                        })}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-4 text-lg text-[var(--muted)]">
                        No approved payouts are ready.
                      </p>
                    )}
                  </section>
                </div>
              </details>
            ) : null}

            <details className="grid rounded-lg border border-[var(--line)] bg-white p-4" open>
              <summary className="cursor-pointer text-xl font-semibold">Chores</summary>
              <div className="mt-4 grid gap-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Waiting for approval</h2>
                  <div className="flex flex-wrap gap-2">
                    <form action={syncScheduleAction}>
                      <button className="min-h-11 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-base font-semibold text-[var(--accent-strong)]">
                        Sync
                      </button>
                    </form>
                    <Link
                      aria-label="Add chore"
                      className="inline-grid min-h-11 min-w-11 place-items-center rounded-lg border border-[var(--line)] bg-white text-2xl font-semibold text-[var(--accent-strong)]"
                      href="/parent/chores/new"
                    >
                      +
                    </Link>
                  </div>
                </div>
                {waitingApproval?.length ? (
                  <div className="grid gap-3">
                    {waitingApproval.map((instance) => {
                      const submission = latestSubmissionByInstanceId.get(instance.id);

                      return (
                        <article
                          className="grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--background)] p-4"
                          id={`approval-${instance.id}`}
                          key={instance.id}
                        >
                          <div className="grid gap-1">
                            <h3 className="text-lg font-semibold">
                              {templateTitleById.get(instance.template_id) ?? "Chore"}
                            </h3>
                            <p className="text-base text-[var(--muted)]">
                              {childNameById.get(instance.assigned_child_profile_id ?? "") ?? "Child"} submitted
                              {instance.value_model_snapshot === "fixed"
                                ? ` • $${(instance.amount_cents_snapshot / 100).toFixed(2)}`
                                : ""}
                            </p>
                            {submission?.note ? (
                              <p className="text-base">{submission.note}</p>
                            ) : null}
                            {submission?.photo_storage_path && !submission.photo_deleted_at ? (
                              <div className="grid gap-3">
                                {signedPhotoUrlBySubmissionId.get(submission.id) ? (
                                  <a
                                    className="block overflow-hidden rounded-lg border border-[var(--line)] bg-white"
                                    href={signedPhotoUrlBySubmissionId.get(submission.id)}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    <img
                                      alt={`Photo proof for ${
                                        templateTitleById.get(instance.template_id) ?? "chore"
                                      }`}
                                      className="max-h-80 w-full object-contain"
                                      src={signedPhotoUrlBySubmissionId.get(submission.id)}
                                    />
                                  </a>
                                ) : (
                                  <p className="rounded-lg border border-[var(--line)] bg-white p-3 text-base text-[var(--muted)]">
                                    Photo proof could not be loaded.
                                  </p>
                                )}
                                <form action={deleteSubmissionPhotoAction}>
                                  <input name="submissionId" type="hidden" value={submission.id} />
                                  <button className="min-h-11 rounded-lg border border-[var(--line)] bg-white px-4 py-2 text-base font-semibold text-[var(--danger)]">
                                    Remove photo
                                  </button>
                                </form>
                              </div>
                            ) : null}
                          </div>

                          {submission ? (
                            <div className="grid gap-3">
                              <form action={approveSubmissionAction} className="grid gap-3">
                                <input name="submissionId" type="hidden" value={submission.id} />
                                <label className="grid gap-2 text-base font-semibold">
                                  Approval note
                                  <input
                                    className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                                    maxLength={500}
                                    name="feedback"
                                    type="text"
                                  />
                                </label>
                                <button className="min-h-12 rounded-lg bg-[var(--accent)] px-4 py-3 text-lg font-semibold text-white">
                                  Approve
                                </button>
                              </form>

                              <form action={rejectSubmissionAction} className="grid gap-3">
                                <input name="submissionId" type="hidden" value={submission.id} />
                                <label className="grid gap-2 text-base font-semibold">
                                  Send back note
                                  <input
                                    className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                                    maxLength={500}
                                    name="feedback"
                                    required
                                    type="text"
                                  />
                                </label>
                                <button className="min-h-12 rounded-lg border border-[var(--danger)] bg-white px-4 py-3 text-lg font-semibold text-[var(--danger)]">
                                  Send back
                                </button>
                              </form>
                            </div>
                          ) : (
                            <p className="text-base text-[var(--muted)]">Submission details unavailable.</p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-4 text-lg text-[var(--muted)]">
                    No chores are waiting for approval.
                  </p>
                )}

                <div className="grid gap-3">
                  <h2 className="text-lg font-semibold">Remaining today</h2>
                  {remainingToday?.length ? (
                    <div className="grid gap-3">
                      {remainingToday.map((instance) => (
                        <article
                          className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-4"
                          key={instance.id}
                        >
                          <h3 className="text-lg font-semibold">
                            {templateTitleById.get(instance.template_id) ?? "Chore"}
                          </h3>
                          <p className="text-base text-[var(--muted)]">
                            {instance.up_for_grabs_slot ? "Available" : "Assigned"}
                          </p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-4 text-lg text-[var(--muted)]">
                      No chores are assigned for today yet.
                    </p>
                  )}
                </div>

                <div className="grid gap-3">
                  <h2 className="text-lg font-semibold">Upcoming</h2>
                  {upcomingInstances?.length ? (
                    <div className="grid gap-3">
                      {upcomingInstances.map((instance) => (
                        <article
                          className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-4"
                          key={instance.id}
                        >
                          <h3 className="text-lg font-semibold">
                            {templateTitleById.get(instance.template_id) ?? "Chore"}
                          </h3>
                          <p className="text-base text-[var(--muted)]">
                            {instance.occurrence_date} •{" "}
                            {instance.up_for_grabs_slot
                              ? "Available"
                              : childNameById.get(instance.assigned_child_profile_id ?? "") ?? "Child"}
                            {instance.status === "rejected" ? " • Needs another try" : ""}
                          </p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-4 text-lg text-[var(--muted)]">
                      No upcoming chores are assigned.
                    </p>
                  )}
                </div>

                <div className="grid gap-3">
                  <h2 className="text-lg font-semibold">Recent history</h2>
                  {recentHistory?.length ? (
                    <div className="grid gap-3">
                      {recentHistory.map((instance) => (
                        <article
                          className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--background)] p-4"
                          key={instance.id}
                        >
                          <div className="grid gap-1">
                            <h3 className="text-lg font-semibold">
                              {templateTitleById.get(instance.template_id) ?? "Chore"}
                            </h3>
                            <p className="text-base text-[var(--muted)]">
                              {childNameById.get(instance.assigned_child_profile_id ?? "") ?? "Child"} •{" "}
                              {instance.status === "approved"
                                ? "Approved"
                                : instance.status === "rejected"
                                  ? "Needs another try"
                                  : "Missed"}{" "}
                              on {instance.occurrence_date}
                              {instance.value_model_snapshot === "fixed"
                                ? ` • $${(instance.amount_cents_snapshot / 100).toFixed(2)}`
                                : ""}
                            </p>
                          </div>

                          {instance.status === "rejected" || instance.status === "expired" ? (
                            <form action={reopenChoreAction} className="grid gap-3">
                              <input name="instanceId" type="hidden" value={instance.id} />
                              <label className="grid gap-2 text-base font-semibold">
                                Reopen note
                                <input
                                  className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                                  maxLength={500}
                                  name="feedback"
                                  type="text"
                                />
                              </label>
                              <button className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg font-semibold text-[var(--accent-strong)]">
                                Reopen
                              </button>
                            </form>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-4 text-lg text-[var(--muted)]">
                      No completed chores yet.
                    </p>
                  )}
                </div>

                <div className="grid gap-3">
                  <h2 className="text-lg font-semibold">Templates</h2>
                  {choreTemplates?.length ? (
                    <div className="grid gap-3">
                      {choreTemplates.map((template) => (
                        <article
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--background)] p-4"
                          key={template.id}
                        >
                          <div className="grid gap-1">
                            <h3 className="text-lg font-semibold">{template.title}</h3>
                            <p className="text-base capitalize text-[var(--muted)]">
                              {template.schedule_type.replace("_", "-")}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Link
                              className="inline-flex min-h-10 items-center rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-base font-semibold"
                              href={`/parent/chores/${template.id}/edit`}
                            >
                              Edit
                            </Link>
                            <form action={deactivateTemplateAction}>
                              <input name="templateId" type="hidden" value={template.id} />
                              <button className="min-h-10 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-base font-semibold text-[var(--danger)]">
                                Deactivate
                              </button>
                            </form>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-4 text-lg text-[var(--muted)]">
                      No chore templates yet.
                    </p>
                  )}
                </div>
              </div>
            </details>
          </>
        ) : null}
      </div>
    </main>
  );
}
