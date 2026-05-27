import Link from "next/link";
import { acceptChildInvitationAction } from "@/app/invite/[invitationId]/actions";
import { SignOutButton } from "@/components/sign-out-button";
import { requireCurrentProfile } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ invitationId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [profile, routeParams, query] = await Promise.all([
    requireCurrentProfile(),
    params,
    searchParams,
  ]);

  return (
    <main className="page-shell">
      <section className="grid min-h-[calc(100dvh-2rem)] content-center gap-8 py-8">
        <header className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className="text-base font-semibold text-[var(--accent-strong)]" href="/">
              Chores
            </Link>
            <SignOutButton />
          </div>
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold leading-tight">Join household</h1>
            <p className="max-w-xl text-lg text-[var(--muted)]">
              {profile.displayName}, accept this invitation to see chores for this household.
            </p>
          </div>
        </header>

        {query.error ? (
          <p className="rounded-lg border border-[var(--danger)] bg-white p-4 text-lg font-medium text-[var(--danger)]">
            {query.error}
          </p>
        ) : null}

        {profile.appRole === "child" ? (
          <form action={acceptChildInvitationAction} className="grid max-w-md gap-4">
            <input name="invitationId" type="hidden" value={routeParams.invitationId} />
            <button className="min-h-12 rounded-lg bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
              Accept invite
            </button>
          </form>
        ) : (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg text-[var(--muted)]">
            This invite is for a child account. Sign out, then sign in with the child account.
          </p>
        )}
      </section>
    </main>
  );
}
