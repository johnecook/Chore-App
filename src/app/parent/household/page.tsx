import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createChildInviteAction,
  createParentInviteAction,
  updateChildAllowanceAction,
  updateParentRoleAction,
  updateHouseholdAction,
} from "@/app/parent/household/actions";
import { HouseholdQueryCleanup } from "@/app/parent/household/household-query-cleanup";
import { InviteLinkActions } from "@/app/parent/household/invite-link-actions";
import { ParentNav } from "@/components/parent-nav";
import { AppShell } from "@/components/ui";
import { getCurrentParentHouseholdId, requireCurrentProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const timezones = [
  { label: "Eastern time", value: "America/New_York" },
  { label: "Central time", value: "America/Chicago" },
  { label: "Mountain time", value: "America/Denver" },
  { label: "Pacific time", value: "America/Los_Angeles" },
];

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

function dollarsFromCents(cents: number) {
  return cents > 0 ? (cents / 100).toFixed(2) : "";
}

function describeAvailabilityPattern(window: {
  cycle_length_days: number;
  available_day_offsets: number[];
} | null) {
  if (!window) {
    return "No pattern set";
  }

  if (window.cycle_length_days === 1 && window.available_day_offsets.includes(0)) {
    return "Every day";
  }

  if (
    window.cycle_length_days === 14 &&
    window.available_day_offsets.length === 7 &&
    window.available_day_offsets.every((offset) => offset >= 0 && offset <= 6)
  ) {
    return "Week on, week off";
  }

  return `${window.available_day_offsets.length} of ${window.cycle_length_days} days`;
}

function EditIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 19h4l10-10a2.8 2.8 0 0 0-4-4L5 15v4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="m14 6 4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CreateInviteSection() {
  return (
    <section aria-labelledby="create-invite-heading" className="grid gap-3">
      <div className="grid gap-1">
        <h2 id="create-invite-heading" className="text-xl font-semibold">
          Create invite code
        </h2>
        <p className="max-w-2xl text-base text-[var(--muted)]">
          Create a household invite link, then copy it or open a prefilled email.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form
          action={createChildInviteAction}
          className="grid content-start gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4"
        >
          <div className="grid gap-1">
            <h3 className="text-xl font-semibold">Child invite</h3>
            <p className="text-base text-[var(--muted)]">
              They sign in with their own child account and accept the invite.
            </p>
          </div>

          <label className="grid gap-2 text-lg font-semibold">
            Child name
            <input
              className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
              name="childName"
              required
              type="text"
            />
          </label>

          <label className="grid gap-2 text-lg font-semibold">
            Child email
            <input
              autoComplete="email"
              className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
              name="childEmail"
              required
              type="email"
            />
          </label>

          <button className="min-h-12 rounded-2xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
            Create invite code
          </button>
        </form>

        <form
          action={createParentInviteAction}
          className="grid content-start gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4"
        >
          <div className="grid gap-1">
            <h3 className="text-xl font-semibold">Parent invite</h3>
            <p className="text-base text-[var(--muted)]">
              Parent accounts belong to one household at a time.
            </p>
          </div>

          <label className="grid gap-2 text-lg font-semibold">
            Parent email
            <input
              autoComplete="email"
              className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
              name="parentEmail"
              required
              type="email"
            />
          </label>

          <button className="min-h-12 rounded-2xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
            Create invite code
          </button>
        </form>
      </div>
    </section>
  );
}

export default async function ParentHouseholdPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string; invited?: string; saved?: string }>;
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
  const requestHeaders = await headers();
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const inviteBaseUrl = host ? `${protocol}://${host}` : "";

  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("id, name, timezone, money_features_enabled, money_mode")
    .eq("id", householdId)
    .maybeSingle();

  if (householdError) {
    throw new Error(householdError.message);
  }

  if (!household) {
    redirect("/onboarding/household");
  }

  const { data: currentMembership, error: currentMembershipError } = await supabase
    .from("household_memberships")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", profile.id)
    .in("role", ["admin", "parent"])
    .maybeSingle();

  if (currentMembershipError) {
    throw new Error(currentMembershipError.message);
  }

  const canManageHousehold = currentMembership?.role === "admin";
  const { data: memberships, error: membershipError } = await supabase
    .from("household_memberships")
    .select("user_id, role, is_primary_payout_parent, joined_at")
    .eq("household_id", householdId)
    .order("joined_at", { ascending: true });

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const userIds = memberships?.map((membership) => membership.user_id) ?? [];
  const { data: users, error: userError } = userIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
    : { data: [], error: null };

  if (userError) {
    throw new Error(userError.message);
  }

  const { data: childProfiles, error: childProfileError } = userIds.length
    ? await supabase
        .from("child_profiles")
        .select("id, user_id, allowance_enabled, base_allowance_cents")
        .eq("primary_household_id", householdId)
        .in("user_id", userIds)
    : { data: [], error: null };

  if (childProfileError) {
    throw new Error(childProfileError.message);
  }

  const childProfileIds = childProfiles?.map((childProfile) => childProfile.id) ?? [];
  const { data: availabilityWindows, error: availabilityWindowError } = childProfileIds.length
    ? await supabase
        .from("child_household_availability_windows")
        .select("child_profile_id, cycle_length_days, available_day_offsets")
        .eq("household_id", householdId)
        .in("child_profile_id", childProfileIds)
    : { data: [], error: null };

  if (availabilityWindowError) {
    throw new Error(availabilityWindowError.message);
  }

  const { data: invitations, error: inviteError } = await supabase
    .from("household_invitations")
    .select("id, email, role, child_display_name, accepted_at, revoked_at, expires_at, created_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });

  if (inviteError) {
    throw new Error(inviteError.message);
  }

  const parents = memberships?.filter((membership) => membership.role !== "child") ?? [];
  const children = memberships?.filter((membership) => membership.role === "child") ?? [];
  const pendingInvites = invitations?.filter((invite) => !invite.accepted_at && !invite.revoked_at) ?? [];
  const createdInvite = params.invited
    ? pendingInvites.find((invite) => invite.id === params.invited)
    : undefined;
  const hasInviteActivity = Boolean(invitations?.length);

  return (
    <AppShell variant="web">
        <HouseholdQueryCleanup />
        <header className="grid gap-4">
          <ParentNav />
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold leading-tight">Household</h1>
            <p className="max-w-xl text-lg text-[var(--muted)]">
              Manage household settings, parents, children, invites, and child availability.
            </p>
          </div>
        </header>

        {params.error ? (
          <p className="rounded-2xl border border-[var(--danger)] bg-[var(--surface-elevated)] p-4 text-lg font-medium text-[var(--danger)]">
            {params.error}
          </p>
        ) : null}

        {params.saved ? (
          <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 text-lg font-medium">
            Household updated.
          </p>
        ) : null}

        {params.created ? (
          <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 text-lg font-medium">
            Household created. Create invite codes for the people who should join next.
          </p>
        ) : null}

        {params.invited ? (
          <div className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 text-lg font-medium">
            <p>
              Invite created. Link:{" "}
              <span className="break-all font-semibold text-[var(--accent-strong)]">
                {inviteBaseUrl}/invite/{params.invited}
              </span>
            </p>
            {createdInvite ? (
              <InviteLinkActions
                email={createdInvite.email}
                inviteUrl={`${inviteBaseUrl}/invite/${createdInvite.id}`}
              />
            ) : null}
          </div>
        ) : null}

        {canManageHousehold && !hasInviteActivity ? <CreateInviteSection /> : null}

        <section aria-labelledby="household-details-heading" className="grid gap-3">
          <h2 id="household-details-heading" className="text-xl font-semibold">
            Details
          </h2>
          <div className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4">
            <div className="grid gap-1">
              <h3 className="text-2xl font-semibold leading-tight">{household.name}</h3>
              <p className="text-base text-[var(--muted)]">{household.timezone}</p>
              <p className="text-base font-medium">
                Money mode:{" "}
                {household.money_mode === "none"
                  ? "No paid chores"
                  : household.money_mode === "allowance_plus_bonus"
                    ? "Allowance plus extra payouts"
                    : "Chores with individual amounts"}
              </p>
            </div>
            {canManageHousehold ? (
              <form action={updateHouseholdAction} className="grid max-w-md gap-4">
                <label className="grid gap-2 text-lg font-semibold">
                  Household name
                  <input
                    className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
                    defaultValue={household.name}
                    name="householdName"
                    required
                    type="text"
                  />
                </label>
                <label className="grid gap-2 text-lg font-semibold">
                  Timezone
                  <select
                    className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
                    defaultValue={household.timezone}
                    name="householdTimezone"
                    required
                  >
                    {timezones.map((timezone) => (
                      <option key={timezone.value} value={timezone.value}>
                        {timezone.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-base text-[var(--muted)]">
                  Money mode is kept separate because changing it can affect payout setup and paid chores.
                </p>
                <button className="min-h-12 rounded-2xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
                  Save household
                </button>
              </form>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="parents-heading" className="grid gap-3">
          <h2 id="parents-heading" className="text-xl font-semibold">
            Parents
          </h2>
          <div className="grid gap-3">
            {parents.map((membership) => {
              const parentUser = users?.find((user) => user.id === membership.user_id);

              return (
                <article
                  className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4"
                  key={membership.user_id}
                >
                  <div className="grid gap-1">
                    <h3 className="text-xl font-semibold leading-snug">
                      {parentUser?.display_name ?? "Parent"}
                    </h3>
                    <p className="text-base text-[var(--muted)]">Parent</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
                    <div className="grid gap-1">
                      <p className="text-sm font-semibold uppercase text-[var(--subtle)]">
                        Household role
                      </p>
                      <p className="text-lg font-semibold">
                        {membership.role === "admin" ? "Admin" : "Parent"}
                        {membership.is_primary_payout_parent ? (
                          <span className="text-base font-medium text-[var(--muted)]">
                            {" "}
                            - Primary payout parent
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  {canManageHousehold && membership.user_id !== profile.id ? (
                    <details className="grid gap-3 border-t border-[var(--line)] pt-3">
                      <summary className="flex min-h-12 w-fit list-none items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-base font-semibold text-[var(--accent-strong)] [&::-webkit-details-marker]:hidden">
                        <EditIcon />
                        Edit role
                      </summary>
                      <form action={updateParentRoleAction} className="grid max-w-xs gap-3 pt-3">
                        <input name="parentUserId" type="hidden" value={membership.user_id} />
                        <label className="grid gap-2 text-base font-semibold">
                          Household role
                          <select
                            className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
                            defaultValue={membership.role}
                            name="role"
                          >
                            <option value="admin">Admin</option>
                            <option value="parent">Parent</option>
                          </select>
                        </label>
                        <button
                          className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg font-semibold"
                          type="submit"
                        >
                          Save role
                        </button>
                      </form>
                    </details>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="children-heading" className="grid gap-3">
          <h2 id="children-heading" className="text-xl font-semibold">
            Children
          </h2>
          <div className="grid gap-3">
            {children.length ? (
              children.map((membership) => {
                const childUser = users?.find((user) => user.id === membership.user_id);
                const childProfile = childProfiles?.find(
                  (profileRecord) => profileRecord.user_id === membership.user_id,
                );
                const availabilityWindow = childProfile
                  ? availabilityWindows?.find((window) => window.child_profile_id === childProfile.id) ?? null
                  : null;
                const allowanceLabel =
                  childProfile?.allowance_enabled
                    ? formatMoney(childProfile.base_allowance_cents)
                    : "Not set";

                return (
                  <article
                    className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4"
                    key={membership.user_id}
                  >
                    <div className="grid gap-1">
                      <h3 className="text-xl font-semibold leading-snug">
                        {childUser?.display_name ?? "Child"}
                      </h3>
                      <p className="text-base text-[var(--muted)]">Child</p>
                    </div>
                    {childProfile ? (
                      <>
                        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
                          <div className="grid gap-1">
                            <p className="text-sm font-semibold uppercase text-[var(--subtle)]">
                              Availability
                            </p>
                            <p className="text-lg font-semibold">
                              {describeAvailabilityPattern(availabilityWindow)}
                            </p>
                          </div>
                          <Link
                            aria-label={`Edit availability for ${childUser?.display_name ?? "child"}`}
                            className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--accent-strong)]"
                            href={`/parent/children/${childProfile.id}/availability?returnTo=${encodeURIComponent("/parent/household")}&returnLabel=${encodeURIComponent("Household")}`}
                            title="Edit availability"
                          >
                            <EditIcon />
                          </Link>
                        </div>
                        {household.money_features_enabled ? (
                          canManageHousehold ? (
                            <details className="grid gap-3 border-t border-[var(--line)] pt-3">
                              <summary className="flex min-h-12 list-none items-center justify-between gap-3 rounded-2xl border border-transparent px-0 py-1 [&::-webkit-details-marker]:hidden">
                                <span className="grid gap-1">
                                  <span className="text-sm font-semibold uppercase text-[var(--subtle)]">
                                    Base allowance
                                  </span>
                                  <span className="text-lg font-semibold">{allowanceLabel}</span>
                                </span>
                                <span
                                  aria-label={`Edit base allowance for ${childUser?.display_name ?? "child"}`}
                                  className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--accent-strong)]"
                                  role="button"
                                  title="Edit base allowance"
                                >
                                  <EditIcon />
                                </span>
                              </summary>
                              <form action={updateChildAllowanceAction} className="grid gap-3 pt-2">
                                <input name="childProfileId" type="hidden" value={childProfile.id} />
                                <label className="flex items-start gap-3 text-base font-semibold">
                                  <input
                                    className="mt-1 size-5"
                                    defaultChecked={childProfile.allowance_enabled}
                                    name="allowanceEnabled"
                                    type="checkbox"
                                  />
                                  <span className="grid gap-1">
                                    <span>Base allowance</span>
                                    <span className="text-sm font-normal text-[var(--muted)]">
                                      Included once per payout period before extra chore payouts.
                                    </span>
                                  </span>
                                </label>
                                <label className="grid gap-2 text-base font-semibold">
                                  Amount per payout period
                                  <input
                                    className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
                                    defaultValue={dollarsFromCents(childProfile.base_allowance_cents)}
                                    inputMode="decimal"
                                    min="0"
                                    name="baseAllowanceDollars"
                                    placeholder="10.00"
                                    step="0.01"
                                    type="number"
                                  />
                                </label>
                                <button
                                  className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg font-semibold text-[var(--accent-strong)]"
                                  type="submit"
                                >
                                  Save allowance
                                </button>
                              </form>
                            </details>
                          ) : (
                            <div className="grid gap-1 border-t border-[var(--line)] pt-3">
                              <p className="text-sm font-semibold uppercase text-[var(--subtle)]">
                                Base allowance
                              </p>
                              <p className="text-lg font-semibold">{allowanceLabel}</p>
                            </div>
                          )
                        ) : null}
                      </>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 text-lg text-[var(--muted)]">
                No children have joined yet.
              </p>
            )}
          </div>
        </section>

        {pendingInvites.length ? (
          <section aria-labelledby="pending-invites-heading" className="grid gap-3">
            <h2 id="pending-invites-heading" className="text-xl font-semibold">
              Pending invites
            </h2>
            <div className="grid gap-3">
              {pendingInvites.map((invite) => (
                <article
                  className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4"
                  key={invite.id}
                >
                  <div className="grid gap-1">
                    <h3 className="text-xl font-semibold leading-snug">
                      {invite.role === "child" ? (invite.child_display_name ?? invite.email) : invite.email}
                    </h3>
                    <p className="text-base font-medium capitalize">{invite.role}</p>
                    <p className="break-all text-base text-[var(--muted)]">{invite.email}</p>
                  </div>
                  <Link
                    className="break-all text-base font-semibold text-[var(--accent-strong)]"
                    href={`/invite/${invite.id}`}
                  >
                    {inviteBaseUrl}/invite/{invite.id}
                  </Link>
                  <InviteLinkActions
                    email={invite.email}
                    inviteUrl={`${inviteBaseUrl}/invite/${invite.id}`}
                  />
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section aria-labelledby="invite-history-heading" className="grid gap-3">
          <h2 id="invite-history-heading" className="text-xl font-semibold">
            Invite history
          </h2>
          <div className="grid gap-3">
            {invitations?.length ? (
              invitations.map((invite) => (
                <article
                  className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4"
                  key={invite.id}
                >
                  <div className="grid gap-1">
                    <h3 className="text-xl font-semibold leading-snug">
                      {invite.role === "child" ? (invite.child_display_name ?? invite.email) : invite.email}
                    </h3>
                    <p className="text-base font-medium capitalize">{invite.role}</p>
                    <p className="break-all text-base text-[var(--muted)]">{invite.email}</p>
                  </div>
                  <p className="text-base font-medium">
                    {invite.accepted_at
                      ? "Accepted"
                      : invite.revoked_at
                        ? "Revoked"
                        : "Waiting"}
                  </p>
                  {!invite.accepted_at && !invite.revoked_at ? (
                    <>
                      <Link
                        className="break-all text-base font-semibold text-[var(--accent-strong)]"
                        href={`/invite/${invite.id}`}
                      >
                        {inviteBaseUrl}/invite/{invite.id}
                      </Link>
                      <InviteLinkActions
                        email={invite.email}
                        inviteUrl={`${inviteBaseUrl}/invite/${invite.id}`}
                      />
                    </>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 text-lg text-[var(--muted)]">
                No invite history yet.
              </p>
            )}
          </div>
        </section>

        {canManageHousehold && hasInviteActivity ? (
          <details className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
            <summary className="cursor-pointer text-xl font-semibold text-white">
              Invite more people
            </summary>
            <div className="mt-4">
              <CreateInviteSection />
            </div>
          </details>
        ) : null}
    </AppShell>
  );
}
