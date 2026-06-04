import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  acceptChildInvitationAction,
  acceptParentInvitationAction,
} from "@/app/invite/[invitationId]/actions";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell } from "@/components/ui";
import { getCurrentProfile } from "@/lib/auth/session";
import { getInviteSignupContext } from "@/lib/invitations";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ invitationId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [routeParams, query] = await Promise.all([params, searchParams]);
  const profile = await getCurrentProfile();

  if (!profile) {
    const invite = await getInviteSignupContext(routeParams.invitationId);
    const next = `/invite/${routeParams.invitationId}`;
    const signInParams = new URLSearchParams({ next });

    if (invite) {
      signInParams.set("invite", invite.id);
    }

    redirect(`/sign-in?${signInParams.toString()}`);
  }

  return (
    <AppShell className="max-w-3xl" variant="web">
      <section className="grid min-h-[calc(100dvh-2rem)] content-center gap-8 py-8">
        <header className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className="flex w-fit items-center gap-3 text-lg font-semibold text-white" href="/">
              <Image
                alt=""
                aria-hidden="true"
                className="h-12 w-12"
                height={48}
                priority
                src="/brand/rhythm-icon.svg"
                width={48}
              />
              Rhythm
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
          <p className="rounded-2xl border border-[var(--danger)] bg-[var(--surface-elevated)] p-4 text-lg font-medium text-[var(--danger)]">
            {query.error}
          </p>
        ) : null}

        {profile.appRole === "child" ? (
          <form action={acceptChildInvitationAction} className="grid max-w-md gap-4">
            <input name="invitationId" type="hidden" value={routeParams.invitationId} />
            <button className="min-h-12 rounded-2xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
              Accept invite
            </button>
          </form>
        ) : profile.appRole === "parent" ? (
          <form action={acceptParentInvitationAction} className="grid max-w-md gap-4">
            <input name="invitationId" type="hidden" value={routeParams.invitationId} />
            <button className="min-h-12 rounded-2xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
              Accept invite
            </button>
          </form>
        ) : (
          <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 text-lg text-[var(--muted)]">
            Sign out, then sign in with the account this invite was sent to.
          </p>
        )}
      </section>
    </AppShell>
  );
}
