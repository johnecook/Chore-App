import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createChildInviteAction,
  createParentInviteAction,
  updateParentRoleAction,
  updateHouseholdAction,
} from "@/app/parent/household/actions";
import { ParentNav } from "@/components/parent-nav";
import { getCurrentParentHouseholdId, requireCurrentProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const timezones = [
  { label: "Eastern time", value: "America/New_York" },
  { label: "Central time", value: "America/Chicago" },
  { label: "Mountain time", value: "America/Denver" },
  { label: "Pacific time", value: "America/Los_Angeles" },
];

export default async function ParentHouseholdPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invited?: string; saved?: string }>;
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
    .select("id, name, timezone, money_features_enabled")
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
    ? await supabase.from("child_profiles").select("id, user_id").in("user_id", userIds)
    : { data: [], error: null };

  if (childProfileError) {
    throw new Error(childProfileError.message);
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

  return (
    <main className="page-shell">
      <div className="grid gap-8 py-6">
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
          <p className="rounded-lg border border-[var(--danger)] bg-white p-4 text-lg font-medium text-[var(--danger)]">
            {params.error}
          </p>
        ) : null}

        {params.saved ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
            Household updated.
          </p>
        ) : null}

        {params.invited ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
            Invite created. Link:{" "}
            <span className="break-all font-semibold text-[var(--accent-strong)]">
              /invite/{params.invited}
            </span>
          </p>
        ) : null}

        <section aria-labelledby="household-details-heading" className="grid gap-3">
          <h2 id="household-details-heading" className="text-xl font-semibold">
            Details
          </h2>
          <div className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
            <div className="grid gap-1">
              <h3 className="text-2xl font-semibold leading-tight">{household.name}</h3>
              <p className="text-base text-[var(--muted)]">{household.timezone}</p>
              <p className="text-base font-medium">
                Money features are {household.money_features_enabled ? "on" : "off"}.
              </p>
            </div>
            {canManageHousehold ? (
              <form action={updateHouseholdAction} className="grid max-w-md gap-4">
                <label className="grid gap-2 text-lg font-semibold">
                  Household name
                  <input
                    className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                    defaultValue={household.name}
                    name="householdName"
                    required
                    type="text"
                  />
                </label>
                <label className="grid gap-2 text-lg font-semibold">
                  Timezone
                  <select
                    className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
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
                <button className="min-h-12 rounded-lg bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
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
                  className="grid gap-1 rounded-lg border border-[var(--line)] bg-white p-4"
                  key={membership.user_id}
                >
                  <h3 className="text-xl font-semibold leading-snug">
                    {parentUser?.display_name ?? "Parent"}
                  </h3>
                  <p className="text-base text-[var(--muted)]">
                    {membership.role === "admin" ? "Admin" : "Parent"}
                    {membership.is_primary_payout_parent ? " - Primary payout parent" : ""}
                  </p>
                  {canManageHousehold && membership.user_id !== profile.id ? (
                    <form action={updateParentRoleAction} className="mt-2 grid max-w-xs gap-3">
                      <input name="parentUserId" type="hidden" value={membership.user_id} />
                      <label className="grid gap-2 text-base font-semibold">
                        Household role
                        <select
                          className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                          defaultValue={membership.role}
                          name="role"
                        >
                          <option value="admin">Admin</option>
                          <option value="parent">Parent</option>
                        </select>
                      </label>
                      <button className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg font-semibold">
                        Save role
                      </button>
                    </form>
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

                return (
                  <article
                    className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4"
                    key={membership.user_id}
                  >
                    <div className="grid gap-1">
                      <h3 className="text-xl font-semibold leading-snug">
                        {childUser?.display_name ?? "Child"}
                      </h3>
                      <p className="text-base text-[var(--muted)]">Child</p>
                    </div>
                    {childProfile ? (
                      <Link
                        className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-center text-lg font-semibold"
                        href={`/parent/children/${childProfile.id}/availability`}
                      >
                        Set availability
                      </Link>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg text-[var(--muted)]">
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
                  className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4"
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
                    /invite/{invite.id}
                  </Link>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {canManageHousehold ? (
          <details className="grid rounded-lg border border-[var(--line)] bg-white p-4" open={!children.length}>
            <summary className="cursor-pointer text-xl font-semibold">
              Invite a child
            </summary>
            <form action={createChildInviteAction} className="mt-4 grid max-w-md gap-4">
              <p className="text-base text-[var(--muted)]">
                They sign in with their own account and accept the invite.
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

        {canManageHousehold ? (
          <details className="grid rounded-lg border border-[var(--line)] bg-white p-4">
            <summary className="cursor-pointer text-xl font-semibold">
              Invite a parent
            </summary>
            <form action={createParentInviteAction} className="mt-4 grid max-w-md gap-4">
              <p className="text-base text-[var(--muted)]">
                Parent accounts belong to one household at a time. Accepting this invite disconnects
                the parent from any previous household.
              </p>

              <label className="grid gap-2 text-lg font-semibold">
                Parent email
                <input
                  autoComplete="email"
                  className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
                  name="parentEmail"
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

        <section aria-labelledby="invite-history-heading" className="grid gap-3">
          <h2 id="invite-history-heading" className="text-xl font-semibold">
            Invite history
          </h2>
          <div className="grid gap-3">
            {invitations?.length ? (
              invitations.map((invite) => (
                <article
                  className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4"
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
                    <Link
                      className="break-all text-base font-semibold text-[var(--accent-strong)]"
                      href={`/invite/${invite.id}`}
                    >
                      /invite/{invite.id}
                    </Link>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg text-[var(--muted)]">
                No invite history yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
