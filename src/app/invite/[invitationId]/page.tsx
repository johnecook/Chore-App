import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  acceptChildInvitationAction,
  acceptParentInvitationAction,
} from "@/app/invite/[invitationId]/actions";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, Button } from "@/components/ui";
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
    <AppShell className="max-w-2xl" variant="web">
      <section className="grid min-h-[calc(100dvh-2rem)] content-center py-6">
        <div className="rhythm-card grid gap-6 p-5 sm:p-7">
          <header className="grid gap-5">
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
            <div className="grid gap-3">
              <p className="text-base font-semibold text-[var(--accent-strong)]">Household invitation</p>
              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Join household</h1>
              <p className="text-lg text-[var(--muted)]">
                You are signed in as <span className="font-semibold text-white">{profile.displayName}</span>.
                Accept this invitation to join the household and see shared chores.
              </p>
            </div>
          </header>

          {query.error ? (
            <p className="rounded-2xl border border-[var(--danger)] bg-[rgba(255,180,180,0.10)] p-4 text-lg font-medium text-[var(--danger)]">
              {query.error}
            </p>
          ) : null}

          {profile.appRole === "child" ? (
            <form action={acceptChildInvitationAction} className="grid gap-3 sm:flex sm:items-center">
              <input name="invitationId" type="hidden" value={routeParams.invitationId} />
              <Button className="w-full sm:w-auto">Accept invite</Button>
            </form>
          ) : profile.appRole === "parent" ? (
            <form action={acceptParentInvitationAction} className="grid gap-3 sm:flex sm:items-center">
              <input name="invitationId" type="hidden" value={routeParams.invitationId} />
              <Button className="w-full sm:w-auto">Accept invite</Button>
            </form>
          ) : (
            <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 text-lg text-[var(--muted)]">
              Sign out, then sign in with the account this invite was sent to.
            </p>
          )}
        </div>
      </section>
    </AppShell>
  );
}
