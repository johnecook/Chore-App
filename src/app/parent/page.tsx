import { redirect } from "next/navigation";
import {
  deleteSubmissionPhotoAction,
  syncScheduleAction,
} from "@/app/parent/actions";
import { ParentApprovalCard } from "@/components/parent-approval-card";
import { ParentNav } from "@/components/parent-nav";
import {
  AppShell,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  MetricCard,
  SegmentedControl,
  TaskRow,
} from "@/components/ui";
import { getCurrentParentHouseholdId, requireCurrentProfile } from "@/lib/auth/session";
import { CHORE_SUBMISSION_PHOTO_BUCKET } from "@/lib/supabase/chore-photo-storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ApprovalChecklistItem = {
  id: string;
  instance_id: string;
  label: string;
  position: number;
  required: boolean;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

export default async function ParentHomePage({
  searchParams,
}: {
  searchParams: Promise<{
    approved?: string;
    error?: string;
    photoDeleted?: string;
    rejected?: string;
    synced?: string;
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

  const children = childProfiles.map((childProfile) => {
    const childUser = childUsers?.find((user) => user.id === childProfile.user_id);
    return {
      id: childProfile.id,
      name: childUser?.display_name ?? "Child",
    };
  });
  const hasChildren = children.length > 0;
  const today = new Date().toISOString().slice(0, 10);

  const { data: waitingApproval, error: approvalError } = await supabase
    .from("chore_instances")
    .select(
      "id, template_id, assigned_child_profile_id, status, value_model_snapshot, amount_cents_snapshot, photo_required_snapshot",
    )
    .eq("earning_household_id", householdId)
    .eq("status", "submitted")
    .order("updated_at", { ascending: false })
    .limit(25);

  if (approvalError) {
    throw new Error(approvalError.message);
  }

  const { data: remainingToday, error: remainingError } = await supabase
    .from("chore_instances")
    .select("id, template_id, assigned_child_profile_id, status, occurrence_date, up_for_grabs_slot")
    .eq("earning_household_id", householdId)
    .eq("occurrence_date", today)
    .in("status", ["assigned", "rejected"])
    .order("created_at", { ascending: false });

  if (remainingError) {
    throw new Error(remainingError.message);
  }

  const { data: availableToday, error: availableError } = await supabase
    .from("chore_instances")
    .select("id, template_id, assigned_child_profile_id, status, occurrence_date, up_for_grabs_slot")
    .eq("earning_household_id", householdId)
    .eq("occurrence_date", today)
    .eq("status", "available")
    .eq("up_for_grabs_slot", true)
    .order("created_at", { ascending: false });

  if (availableError) {
    throw new Error(availableError.message);
  }

  const { data: completedToday, error: completedError } = await supabase
    .from("chore_instances")
    .select(
      "id, template_id, assigned_child_profile_id, status, occurrence_date, updated_at, value_model_snapshot, amount_cents_snapshot",
    )
    .eq("earning_household_id", householdId)
    .eq("occurrence_date", today)
    .eq("status", "approved")
    .order("updated_at", { ascending: false });

  if (completedError) {
    throw new Error(completedError.message);
  }

  const dashboardTemplateIds = [
    ...new Set([
      ...(waitingApproval?.map((instance) => instance.template_id) ?? []),
      ...(remainingToday?.map((instance) => instance.template_id) ?? []),
      ...(availableToday?.map((instance) => instance.template_id) ?? []),
      ...(completedToday?.map((instance) => instance.template_id) ?? []),
    ]),
  ];
  const { data: dashboardTemplates, error: dashboardTemplateError } = dashboardTemplateIds.length
    ? await supabase.from("chore_templates").select("id, title").in("id", dashboardTemplateIds)
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
  const { data: approvalChecklistItems, error: approvalChecklistError } = submittedInstanceIds.length
    ? await supabase
        .from("chore_instance_checklist_items")
        .select("id, instance_id, label, position, required")
        .in("instance_id", submittedInstanceIds)
        .order("position", { ascending: true })
    : { data: [], error: null };

  if (approvalChecklistError) {
    throw new Error(approvalChecklistError.message);
  }

  const submissionIds = submissions?.map((submission) => submission.id) ?? [];
  const { data: submittedChecklistItems, error: submittedChecklistError } = submissionIds.length
    ? await supabase
        .from("chore_submission_checklist_items")
        .select("submission_id, instance_checklist_item_id, checked")
        .in("submission_id", submissionIds)
    : { data: [], error: null };

  if (submittedChecklistError) {
    throw new Error(submittedChecklistError.message);
  }

  const checklistByInstanceId = new Map<string, ApprovalChecklistItem[]>();
  for (const item of approvalChecklistItems ?? []) {
    const existingItems = checklistByInstanceId.get(item.instance_id) ?? [];
    existingItems.push(item);
    checklistByInstanceId.set(item.instance_id, existingItems);
  }

  const checkedChecklistItemIdsBySubmissionId = new Map<string, Set<string>>();
  for (const item of submittedChecklistItems ?? []) {
    if (!item.checked) {
      continue;
    }

    const checkedIds = checkedChecklistItemIdsBySubmissionId.get(item.submission_id) ?? new Set<string>();
    checkedIds.add(item.instance_checklist_item_id);
    checkedChecklistItemIdsBySubmissionId.set(item.submission_id, checkedIds);
  }
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

  return (
    <AppShell
      variant="web"
    >
        <ParentNav />
        <header className="grid gap-4 rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(7,24,66,0.96),rgba(12,37,90,0.92))] p-5 shadow-[0_22px_70px_rgba(2,7,28,0.26)] md:grid-cols-[1fr_auto] md:items-end">
          <div className="grid gap-1">
            <p className="text-base font-medium text-white/80">Good morning,</p>
            <h1 className="text-4xl font-semibold leading-tight text-white">Parent dashboard</h1>
            <p className="max-w-2xl text-base text-[var(--muted)]">
              {profile.displayName}, review approvals, open responsibilities, and household activity.
            </p>
          </div>
          <form action={syncScheduleAction}>
            <Button className="min-h-12 px-5 py-3 text-base" variant="secondary">
              Sync schedule
            </Button>
          </form>
        </header>

        <SegmentedControl
          items={[
            { label: "Overview", selected: true },
            { label: "Kids" },
            { label: "Household" },
          ]}
        />

        <Card as="section" aria-label="Household status">
          <div className="grid gap-1">
            <p className="text-base font-semibold text-white">Household status</p>
            <p className="text-sm text-[var(--muted)]">What needs parent attention today.</p>
          </div>
          <div className="grid grid-cols-3">
            <MetricCard icon="!" label="Needs review" value={waitingApproval?.length ?? 0} />
            <MetricCard
              icon="≡"
              label="Open today"
              value={(remainingToday?.length ?? 0) + (availableToday?.length ?? 0)}
            />
            <MetricCard
              icon="✓"
              label="Completed"
              value={completedToday?.length ?? 0}
            />
          </div>
        </Card>

        {!hasChildren ? (
          <Card as="section">
            <h2 className="text-xl font-semibold">Set up household members</h2>
            <p className="text-base text-[var(--muted)]">
              Add your first child before creating chore templates.
            </p>
            <ButtonLink href="/parent/household">
              Open household
            </ButtonLink>
          </Card>
        ) : null}

        {params.error ? (
          <Card as="div" className="border-[var(--danger)] text-lg font-medium text-[var(--danger)]">
            {params.error}
          </Card>
        ) : null}

        {params.approved ? (
          <Card as="div" className="text-lg font-medium">
            Chore approved.
          </Card>
        ) : null}

        {params.rejected ? (
          <Card as="div" className="text-lg font-medium">
            Chore sent back.
          </Card>
        ) : null}

        {params.photoDeleted ? (
          <Card as="div" className="text-lg font-medium">
            Photo removed.
          </Card>
        ) : null}

        {params.synced ? (
          <Card as="div" className="text-lg font-medium">
            Chore schedule synced.
          </Card>
        ) : null}

        {availableToday?.length ? (
          <section aria-labelledby="available-heading" className="grid gap-3">
            <h2 id="available-heading" className="text-xl font-semibold">
              Up for grabs today
            </h2>
            <div className="grid gap-3">
              {availableToday.map((instance) => (
                <TaskRow
                  status="Available"
                  statusTone="accent"
                  icon="+"
                  title={templateTitleById.get(instance.template_id) ?? "Chore"}
                  key={instance.id}
                >
                  <p className="text-base text-[var(--muted)]">Available until claimed.</p>
                </TaskRow>
              ))}
            </div>
          </section>
        ) : null}

        {hasChildren ? (
          <section aria-labelledby="today-by-child-heading" className="grid gap-3">
            <h2 id="today-by-child-heading" className="text-xl font-semibold">
              Today by child
            </h2>
            <div className="grid gap-3">
              {children.map((child) => {
                const approvalItems =
                  waitingApproval?.filter(
                    (instance) => instance.assigned_child_profile_id === child.id,
                  ) ?? [];
                const remainingItems =
                  remainingToday?.filter(
                    (instance) => instance.assigned_child_profile_id === child.id,
                  ) ?? [];
                const completedItems =
                  completedToday?.filter(
                    (instance) => instance.assigned_child_profile_id === child.id,
                  ) ?? [];
                const childSummary = [
                  approvalItems.length ? `${approvalItems.length} approval` : null,
                  remainingItems.length ? `${remainingItems.length} remaining` : null,
                  completedItems.length ? `${completedItems.length} completed` : null,
                ]
                  .filter((item): item is string => item !== null)
                  .join(" • ");

                return (
                  <details
                    className="rhythm-card grid p-4 sm:p-5"
                    key={child.id}
                    open
                  >
                    <summary className="cursor-pointer text-xl font-semibold">
                      {child.name}
                      {childSummary ? (
                        <span className="ml-2 inline-block text-base font-semibold text-[var(--muted)]">
                          {childSummary}
                        </span>
                      ) : null}
                    </summary>
                    <div className="mt-4 grid gap-6">
                      <section className="grid gap-3">
                        <h3 className="text-lg font-semibold">Items for approval</h3>
                        {approvalItems.length ? (
                          <div className="grid gap-3">
                            {approvalItems.map((instance) => {
                              const submission = latestSubmissionByInstanceId.get(instance.id);
                              const checklistItems = checklistByInstanceId.get(instance.id) ?? [];
                              const checkedChecklistItemIds = submission
                                ? checkedChecklistItemIdsBySubmissionId.get(submission.id)
                                : undefined;

                              return (
                                <ParentApprovalCard
                                  instanceId={instance.id}
                                  key={instance.id}
                                  submissionId={submission?.id}
                                >
                                  <div className="grid gap-1">
                                    <h4 className="text-lg font-semibold">
                                      {templateTitleById.get(instance.template_id) ?? "Chore"}
                                    </h4>
                                    <p className="text-base text-[var(--muted)]">
                                      Submitted
                                      {instance.value_model_snapshot === "fixed"
                                        ? ` • ${formatMoney(instance.amount_cents_snapshot)}`
                                        : ""}
                                    </p>
                                    {submission?.note ? (
                                      <p className="text-base">{submission.note}</p>
                                    ) : null}
                                    {checklistItems.length ? (
                                      <div className="grid gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
                                        <p className="text-base font-semibold">Checklist</p>
                                        <ul className="grid gap-1 text-base text-[var(--muted)]">
                                          {checklistItems.map((item) => (
                                            <li key={item.id}>
                                              {checkedChecklistItemIds?.has(item.id)
                                                ? "Done"
                                                : "Missing"}{" "}
                                              - {item.label}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    ) : null}
                                    {submission?.photo_storage_path && !submission.photo_deleted_at ? (
                                      <div className="grid gap-3">
                                        {signedPhotoUrlBySubmissionId.get(submission.id) ? (
                                          <a
                                            className="block overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]"
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
                                          <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 text-base text-[var(--muted)]">
                                            Photo proof could not be loaded.
                                          </p>
                                        )}
                                        <form action={deleteSubmissionPhotoAction}>
                                          <input name="submissionId" type="hidden" value={submission.id} />
                                          <Button className="min-h-11 px-4 py-2 text-base" variant="danger">
                                            Remove photo
                                          </Button>
                                        </form>
                                      </div>
                                    ) : null}
                                  </div>
                                  {!submission ? (
                                    <p className="text-base text-[var(--muted)]">
                                      Submission details unavailable.
                                    </p>
                                  ) : null}
                                </ParentApprovalCard>
                              );
                            })}
                          </div>
                        ) : (
                          <EmptyState title="Nothing needs approval." />
                        )}
                      </section>

                      <section className="grid gap-3">
                        <h3 className="text-lg font-semibold">Items remaining for the day</h3>
                        {remainingItems.length ? (
                          <div className="grid gap-3">
                            {remainingItems.map((instance) => (
                              <TaskRow
                                status={instance.status === "rejected" ? "Needs another try" : "Assigned"}
                                statusTone={instance.status === "rejected" ? "danger" : "default"}
                                icon="≡"
                                title={templateTitleById.get(instance.template_id) ?? "Chore"}
                                key={instance.id}
                              />
                            ))}
                          </div>
                        ) : (
                          <EmptyState title="Nothing remains for today." />
                        )}
                      </section>

                      <section className="grid gap-3">
                        <h3 className="text-lg font-semibold">Completed items</h3>
                        {completedItems.length ? (
                          <div className="grid gap-3">
                            {completedItems.map((instance) => (
                              <TaskRow
                                amountCents={
                                  instance.value_model_snapshot === "fixed"
                                    ? instance.amount_cents_snapshot
                                    : undefined
                                }
                                status="Approved"
                                statusTone="success"
                                icon="✓"
                                title={templateTitleById.get(instance.template_id) ?? "Chore"}
                                key={instance.id}
                              />
                            ))}
                          </div>
                        ) : (
                          <EmptyState title="No completed items yet today." />
                        )}
                      </section>
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        ) : null}
    </AppShell>
  );
}
