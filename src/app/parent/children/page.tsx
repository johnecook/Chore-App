import Link from "next/link";
import { redirect } from "next/navigation";
import { createChildInviteAction } from "@/app/parent/children/actions";
import { ParentNav } from "@/components/parent-nav";
import { getCurrentParentHouseholdId, requireCurrentProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ParentChildrenPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invited?: string }>;
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
  const { data: invitations, error } = await supabase
    .from("household_invitations")
    .select("id, email, child_display_name, accepted_at, revoked_at, expires_at, created_at")
    .eq("household_id", householdId)
    .eq("role", "child")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

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

  const hasChildren = Boolean(childProfiles?.length);
  const pendingInvites = invitations?.filter((invite) => !invite.accepted_at && !invite.revoked_at) ?? [];

  return (
    <main className="page-shell">
      <div className="grid gap-8 py-6">
        <header className="grid gap-4">
          <ParentNav />
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold leading-tight">Children</h1>
            <p className="max-w-xl text-lg text-[var(--muted)]">
              Manage child accounts and custody availability for this household.
            </p>
          </div>
        </header>

        {params.error ? (
          <p className="rounded-lg border border-[var(--danger)] bg-white p-4 text-lg font-medium text-[var(--danger)]">
            {params.error}
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

        <section aria-label="Children in this household" className="grid gap-3">
          <div className="grid gap-3">
            {hasChildren ? (
              childProfiles.map((childProfile) => {
                const childUser = childUsers?.find((user) => user.id === childProfile.user_id);

                return (
                  <article
                    className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4"
                    key={childProfile.id}
                  >
                    <h3 className="text-xl font-semibold leading-snug">
                      {childUser?.display_name ?? "Child"}
                    </h3>
                    <Link
                      className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg font-semibold"
                      href={`/parent/children/${childProfile.id}/availability`}
                    >
                      Set availability
                    </Link>
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
                      {invite.child_display_name ?? invite.email}
                    </h3>
                    <p className="break-all text-base text-[var(--muted)]">{invite.email}</p>
                  </div>
                  <p className="text-base font-medium">Waiting</p>
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

        <details className="grid rounded-lg border border-[var(--line)] bg-white p-4" open={!hasChildren}>
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
                      {invite.child_display_name ?? invite.email}
                    </h3>
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
