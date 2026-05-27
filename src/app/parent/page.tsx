import Link from "next/link";
import { redirect } from "next/navigation";
import {
  approveSubmissionAction,
  closeOutPayoutAction,
  rejectSubmissionAction,
} from "@/app/parent/actions";
import { createChildInviteAction } from "@/app/parent/children/actions";
import { ParentNav } from "@/components/parent-nav";
import { getCurrentParentHouseholdId, requireCurrentProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ParentHomePage({
  searchParams,
}: {
  searchParams: Promise<{
    approved?: string;
    createdChore?: string;
    error?: string;
    paid?: string;
    rejected?: string;
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

  const { data: pendingInvites, error: inviteError } = await supabase
    .from("household_invitations")
    .select("id, email, child_display_name")
    .eq("household_id", householdId)
    .eq("role", "child")
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (inviteError) {
    throw new Error(inviteError.message);
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

  const templateTitleById = new Map(
    choreTemplates?.map((template) => [template.id, template.title]) ?? [],
  );
  const submittedInstanceIds = waitingApproval?.map((instance) => instance.id) ?? [];
  const { data: submissions, error: submissionError } = submittedInstanceIds.length
    ? await supabase
        .from("chore_submissions")
        .select("id, instance_id, note, photo_storage_path, attempt_number, submitted_at")
        .in("instance_id", submittedInstanceIds)
        .order("attempt_number", { ascending: false })
    : { data: [], error: null };

  if (submissionError) {
    throw new Error(submissionError.message);
  }

  const latestSubmissionByInstanceId = new Map(
    submissions?.map((submission) => [submission.instance_id, submission]) ?? [],
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
          <details className="grid rounded-lg border border-[var(--line)] bg-white p-4" open>
            <summary className="cursor-pointer text-xl font-semibold">Invite a child</summary>
            <form action={createChildInviteAction} className="mt-4 grid max-w-md gap-4">
              <p className="text-base text-[var(--muted)]">
                Add your first child before creating chore templates.
              </p>
              <label className="grid gap-2 text-lg font-semibold">
                Child name
                <input
                  className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                  name="childName"
                  required
                  type="text"
                />
              </label>
              <label className="grid gap-2 text-lg font-semibold">
                Child email
                <input
                  autoComplete="email"
                  className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                  name="childEmail"
                  required
                  type="email"
                />
              </label>
              <button className="min-h-12 rounded-lg bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
                Create invite
              </button>
            </form>
          </details>
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

        {params.approved ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
            Chore approved.
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

        {hasChildren ? (
          <>
            {moneyFeaturesEnabled ? (
            <details className="grid rounded-lg border border-[var(--line)] bg-white p-4" open>
              <summary className="cursor-pointer text-xl font-semibold">Money</summary>
              <div className="mt-4 grid gap-3">
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
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-4 text-lg text-[var(--muted)]">
                    No approved payouts are ready.
                  </p>
                )}
              </div>
            </details>
            ) : null}

            <details className="grid rounded-lg border border-[var(--line)] bg-white p-4" open>
              <summary className="cursor-pointer text-xl font-semibold">Chores</summary>
              <div className="mt-4 grid gap-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Waiting for approval</h2>
                  <Link
                    aria-label="Add chore"
                    className="inline-grid min-h-11 min-w-11 place-items-center rounded-lg border border-[var(--line)] bg-white text-2xl font-semibold text-[var(--accent-strong)]"
                    href="/parent/chores/new"
                  >
                    +
                  </Link>
                </div>
                {waitingApproval?.length ? (
                  <div className="grid gap-3">
                    {waitingApproval.map((instance) => {
                      const submission = latestSubmissionByInstanceId.get(instance.id);

                      return (
                        <article
                          className="grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--background)] p-4"
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
                            {submission?.photo_storage_path ? (
                              <p className="break-all text-base text-[var(--muted)]">
                                Photo: {submission.photo_storage_path}
                              </p>
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
                  <h2 className="text-lg font-semibold">Templates</h2>
                  {choreTemplates?.length ? (
                    <div className="grid gap-3">
                      {choreTemplates.map((template) => (
                        <article
                          className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-4"
                          key={template.id}
                        >
                          <h3 className="text-lg font-semibold">{template.title}</h3>
                          <p className="text-base capitalize text-[var(--muted)]">
                            {template.schedule_type.replace("_", "-")}
                          </p>
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

            <details className="grid rounded-lg border border-[var(--line)] bg-white p-4" open>
              <summary className="cursor-pointer text-xl font-semibold">Children</summary>
              <div className="mt-4 grid gap-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Household children</h2>
                  <Link
                    aria-label="Invite child"
                    className="inline-grid min-h-11 min-w-11 place-items-center rounded-lg border border-[var(--line)] bg-white text-2xl font-semibold text-[var(--accent-strong)]"
                    href="/parent/children"
                  >
                    +
                  </Link>
                </div>
                <div className="grid gap-3">
                  {children.map((child) => (
                    <Link
                      className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-4 text-xl font-semibold"
                      href={`/parent/children/${child.id}/availability`}
                      key={child.id}
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>

                {pendingInvites?.length ? (
                  <div className="grid gap-3">
                    <h2 className="text-lg font-semibold">Pending invites</h2>
                    {pendingInvites.map((invite) => (
                      <article
                        className="grid gap-1 rounded-lg border border-[var(--line)] bg-[var(--background)] p-4"
                        key={invite.id}
                      >
                        <h3 className="text-lg font-semibold">
                          {invite.child_display_name ?? invite.email}
                        </h3>
                        <p className="break-all text-base text-[var(--muted)]">{invite.email}</p>
                      </article>
                    ))}
                  </div>
                ) : null}
              </div>
            </details>
          </>
        ) : null}
      </div>
    </main>
  );
}
