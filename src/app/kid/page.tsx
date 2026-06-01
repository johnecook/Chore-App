import { redirect } from "next/navigation";
import { claimChoreAction, submitChoreAction } from "@/app/kid/actions";
import {
  AppScreen,
  BalanceCard,
  BottomTabBar,
  Button,
  HeaderGreeting,
  SectionHeader,
  SegmentedControl,
  TaskRow,
} from "@/components/rhythm-child-today-static";
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
type ApprovalEvent = Pick<
  Database["public"]["Tables"]["approval_events"]["Row"],
  "instance_id" | "event_type" | "feedback" | "created_at"
>;
type ChecklistItem = Pick<
  Database["public"]["Tables"]["chore_instance_checklist_items"]["Row"],
  "id" | "instance_id" | "label" | "position" | "required"
>;

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

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
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
  checklistItems,
  household,
  instance,
  moneyFeaturesEnabled,
  parentFeedback,
  template,
}: {
  checklistItems: ChecklistItem[];
  household?: Household;
  instance: ChoreInstance;
  moneyFeaturesEnabled: boolean;
  parentFeedback?: string | null;
  template?: ChoreTemplate;
}) {
  return (
    <TaskRow
      amount={
        moneyFeaturesEnabled && instance.value_model_snapshot === "fixed"
          ? formatMoney(instance.amount_cents_snapshot)
          : statusLabel(instance)
      }
      done={instance.status === "submitted"}
      meta={
        <>
          {dueLabel(instance)}
          {household ? ` • ${household.name}` : ""}
        </>
      }
      statusLabel={statusLabel(instance)}
      icon={instance.status === "rejected" ? "↺" : "▭"}
      title={template?.title ?? "Chore"}
    >
      <div className="grid gap-1">
        {template?.description ? (
          <p className="text-base text-[var(--muted)]">{template.description}</p>
        ) : null}
        {parentFeedback ? (
          <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-3 text-base">
            Parent note: {parentFeedback}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 text-base font-semibold">
        {instance.photo_required_snapshot ? (
          <span className="rounded-full border border-[#AEEBF2]/30 bg-white/[0.08] px-3 py-1 text-sm text-[#AEEBF2]">
            Photo required
          </span>
        ) : null}
      </div>
      <form action={submitChoreAction} className="grid gap-3" encType="multipart/form-data">
        <input name="instanceId" type="hidden" value={instance.id} />
        {checklistItems.length ? (
          <fieldset className="grid gap-3">
            <legend className="text-base font-semibold">Checklist</legend>
            <div className="grid gap-2">
              {checklistItems.map((item) => (
                <label
                  className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/[0.10] bg-white/[0.06] px-3 py-2 text-base font-medium text-white"
                  key={item.id}
                >
                  <input
                    className="size-5"
                    name="checkedChecklistItemIds"
                    required={item.required}
                    type="checkbox"
                    value={item.id}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <label className="grid gap-2 text-base font-semibold">
          Note
          <textarea
            className="min-h-24 rounded-2xl border border-white/[0.10] bg-white/[0.06] px-4 py-3 text-lg text-white"
            maxLength={500}
            name="note"
          />
        </label>
        {instance.photo_required_snapshot ? (
          <label className="grid gap-2 text-base font-semibold">
            Photo proof
            <input
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="min-h-12 rounded-2xl border border-white/[0.10] bg-white/[0.06] px-4 py-3 text-lg file:mr-4 file:rounded-md file:border-0 file:bg-[#061842] file:px-3 file:py-2 file:text-base file:font-semibold file:text-[#AEEBF2]"
              name="photo"
              required
              type="file"
            />
          </label>
        ) : null}
        <Button>
          Submit
        </Button>
      </form>
    </TaskRow>
  );
}

function ChoreClaimCard({
  checklistItems,
  household,
  instance,
  template,
}: {
  checklistItems: ChecklistItem[];
  household?: Household;
  instance: ChoreInstance;
  template?: ChoreTemplate;
}) {
  return (
    <TaskRow
      amount="Available"
      meta={
        <>
          {dueLabel(instance)}
          {household ? ` • ${household.name}` : ""}
        </>
      }
      icon="+"
      title={template?.title ?? "Chore"}
    >
      <div className="grid gap-1">
        {template?.description ? (
          <p className="text-base text-[var(--muted)]">{template.description}</p>
        ) : null}
      </div>
      {checklistItems.length ? (
        <ul className="grid gap-1 text-base text-[var(--muted)]">
          {checklistItems.map((item) => (
            <li key={item.id}>{item.label}</li>
          ))}
        </ul>
      ) : null}
      <form action={claimChoreAction}>
        <input name="instanceId" type="hidden" value={instance.id} />
        <Button>
          Claim
        </Button>
      </form>
    </TaskRow>
  );
}

export default async function KidHomePage({
  searchParams,
}: {
  searchParams: Promise<{ claimed?: string; error?: string; submitted?: string }>;
}) {
  const [profile, params] = await Promise.all([requireCurrentProfile(), searchParams]);

  if (profile.appRole === "parent") {
    redirect("/parent");
  }

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

  const instanceIds = instances?.map((instance) => instance.id) ?? [];
  const { data: checklistItems, error: checklistError } = instanceIds.length
    ? await supabase
        .from("chore_instance_checklist_items")
        .select("id, instance_id, label, position, required")
        .in("instance_id", instanceIds)
        .order("position", { ascending: true })
    : { data: [], error: null };

  if (checklistError) {
    throw new Error(checklistError.message);
  }

  const checklistByInstanceId = new Map<string, ChecklistItem[]>();
  for (const item of checklistItems ?? []) {
    const existingItems = checklistByInstanceId.get(item.instance_id) ?? [];
    existingItems.push(item);
    checklistByInstanceId.set(item.instance_id, existingItems);
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
  const rejectedInstanceIds =
    instances?.filter((instance) => instance.status === "rejected").map((instance) => instance.id) ?? [];
  const { data: approvalEvents, error: approvalEventError } = rejectedInstanceIds.length
    ? await supabase
        .from("approval_events")
        .select("instance_id, event_type, feedback, created_at")
        .in("instance_id", rejectedInstanceIds)
        .eq("event_type", "rejected")
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (approvalEventError) {
    throw new Error(approvalEventError.message);
  }

  const latestRejectedFeedbackByInstanceId = new Map(
    approvalEvents?.reduce<Array<[string, ApprovalEvent]>>((rows, event) => {
      if (!rows.some(([instanceId]) => instanceId === event.instance_id)) {
        rows.push([event.instance_id, event]);
      }

      return rows;
    }, []) ?? [],
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

  const { data: unreadNotifications, error: unreadNotificationError } = await supabase
    .from("notification_events")
    .select("id")
    .eq("recipient_profile_id", profile.id)
    .is("read_at", null);

  if (unreadNotificationError) {
    throw new Error(unreadNotificationError.message);
  }

  const unreadNotificationCount = unreadNotifications?.length ?? 0;
  const approvedBalanceCents =
    ledgerRows?.reduce((total, ledger) => total + ledger.amount_cents, 0) ?? 0;
  const completedCount = waitingChores.length;
  const totalVisibleTasks = toDoChores.length + waitingChores.length;
  const progressPercentage = totalVisibleTasks ? Math.round((completedCount / totalVisibleTasks) * 100) : 0;

  return (
    <AppScreen>
      <div>
        <HeaderGreeting
          action={
            <a
              aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ""}`}
              className="relative flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-xl text-white"
              href="/notifications"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M15.5 18a3.5 3.5 0 0 1-7 0M5.5 16.5h13l-1.6-2.3V10a4.9 4.9 0 0 0-9.8 0v4.2l-1.6 2.3Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
              {unreadNotificationCount ? (
                <span className="absolute right-1.5 top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#2CEBFF] px-1 text-xs font-bold leading-none text-[#061842]">
                  {unreadNotificationCount}
                </span>
              ) : null}
            </a>
          }
          initial={profile.displayName.slice(0, 1).toUpperCase()}
          name={`${profile.displayName}!`}
        />
        <div className="grid gap-5 px-5 pb-5">
        <SegmentedControl
          items={[
            { label: "Today", selected: true },
            { label: "This Week" },
            { label: "All" },
          ]}
        />

        {params.error ? (
          <div className="rounded-[18px] border border-[#ffb4b4]/40 bg-[#ffb4b4]/10 p-4 text-lg font-medium text-[#ffb4b4]">
            {params.error}
          </div>
        ) : null}

        {params.claimed ? (
          <div className="rounded-[18px] bg-white/[0.08] p-4 text-lg font-medium text-white">
            Chore claimed.
          </div>
        ) : null}

        {params.submitted ? (
          <div className="rounded-[18px] bg-white/[0.08] p-4 text-lg font-medium text-white">
            Chore submitted.
          </div>
        ) : null}

        {!childProfile ? (
          <div className="rounded-[20px] bg-[linear-gradient(145deg,rgba(43,59,120,0.96),rgba(11,36,88,0.96))] p-4">
            <p className="text-lg font-bold text-white">No household yet</p>
            <p className="mt-1 text-base text-white/75">
              Accept a household invite before chores can appear here.
            </p>
          </div>
        ) : null}

        {toDoChores.length || waitingChores.length ? (
          <section className="grid gap-2" aria-labelledby="tasks-heading">
            <SectionHeader
              action={`${completedCount} of ${totalVisibleTasks} done`}
              title="My tasks"
            />
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.10]">
              <div
                className="h-full rounded-full bg-[#45F1F1]"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="rounded-[20px] bg-[linear-gradient(145deg,rgba(43,59,120,0.96),rgba(11,36,88,0.96))] px-3 py-1 shadow-[0_16px_34px_rgba(2,7,28,0.22)]">
              {toDoSections.map((section) =>
                section.items.map((instance) => (
                    <ChoreSubmitCard
                      checklistItems={checklistByInstanceId.get(instance.id) ?? []}
                      household={householdById.get(instance.earning_household_id)}
                      instance={instance}
                      key={instance.id}
                      moneyFeaturesEnabled={moneyFeaturesEnabled}
                      parentFeedback={latestRejectedFeedbackByInstanceId.get(instance.id)?.feedback}
                      template={templateById.get(instance.template_id)}
                    />
                )),
              )}
              {waitingChores.map((instance) => {
                const template = templateById.get(instance.template_id);

                return (
                  <TaskRow
                    amount={
                      moneyFeaturesEnabled && instance.value_model_snapshot === "fixed"
                        ? formatMoney(instance.amount_cents_snapshot)
                        : "Submitted"
                    }
                    done
                    icon="✓"
                    key={instance.id}
                    meta={householdById.get(instance.earning_household_id)?.name}
                    statusLabel={statusLabel(instance)}
                    title={template?.title ?? "Chore"}
                  />
                );
              })}
            </div>
          </section>
        ) : (
          <div className="rounded-[20px] bg-[linear-gradient(145deg,rgba(43,59,120,0.96),rgba(11,36,88,0.96))] p-4">
            <p className="text-lg font-bold text-white">No chores are ready to submit.</p>
          </div>
        )}

        {availableChores.length ? (
          <section className="grid gap-2" aria-labelledby="available-heading">
            <SectionHeader title="Available" />
            <div className="rounded-[20px] bg-[linear-gradient(145deg,rgba(43,59,120,0.96),rgba(11,36,88,0.96))] px-3 py-1 shadow-[0_16px_34px_rgba(2,7,28,0.22)]">
              {availableChores.map((instance) => {
                const template = templateById.get(instance.template_id);

                return (
                    <ChoreClaimCard
                    checklistItems={checklistByInstanceId.get(instance.id) ?? []}
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

        {childProfile && moneyFeaturesEnabled ? (
          <BalanceCard balanceCents={approvedBalanceCents} href="/kid/money" />
        ) : null}
        </div>
      </div>
      <BottomTabBar />
    </AppScreen>
  );
}
