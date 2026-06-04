import Link from "next/link";
import { signUpAction } from "@/app/auth/actions";
import { AuthFrame } from "@/components/auth-frame";
import { PasswordField } from "@/components/password-field";
import { getInviteSignupContext } from "@/lib/invitations";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string; next?: string }>;
}) {
  const params = await searchParams;
  const invite = await getInviteSignupContext(params.invite);
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : undefined;
  const signInParams = new URLSearchParams();

  if (invite) {
    signInParams.set("invite", invite.id);
  }

  if (next) {
    signInParams.set("next", next);
  }

  return (
    <AuthFrame
      footer={
        <>
          Already have an account?{" "}
          <Link
            className="font-semibold text-[var(--accent-strong)]"
            href={`/sign-in${signInParams.size > 0 ? `?${signInParams.toString()}` : ""}`}
          >
            Sign in
          </Link>
        </>
      }
      intro={
        invite?.role === "parent"
          ? `Create a parent account with ${invite.email} to join this household.`
          : invite?.role === "child"
            ? `Create a child account with ${invite.email} to join this household and see assigned chores.`
            : "Start with email and password. Parent-managed child sign-in can fit this account model later."
      }
      title={
        invite?.role === "parent"
          ? "Create parent account"
          : invite?.role === "child"
            ? "Create child account"
            : "Create account"
      }
    >
        {params.error ? (
          <p className="rounded-2xl border border-[var(--danger)] bg-[var(--surface-elevated)] p-4 text-lg font-medium text-[var(--danger)]">
            {params.error}
          </p>
        ) : null}

        <form action={signUpAction} className="grid gap-4">
          {invite ? (
            <>
              <input name="invitationId" type="hidden" value={invite.id} />
              <input name="appRole" type="hidden" value={invite.role} />
            </>
          ) : null}
          {next ? <input name="next" type="hidden" value={next} /> : null}

          <label className="grid gap-2 text-lg font-semibold">
            Name
            <input
              autoComplete="name"
              className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
              defaultValue={invite?.role === "child" ? invite.childDisplayName ?? undefined : undefined}
              name="displayName"
              required
              type="text"
            />
          </label>

          <label className="grid gap-2 text-lg font-semibold">
            Email
            <input
              autoComplete="email"
              className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
              defaultValue={invite?.email}
              name="email"
              readOnly={Boolean(invite)}
              required
              type="email"
            />
          </label>

          <PasswordField
            autoComplete="new-password"
            label="Password"
            minLength={8}
            name="password"
          />

          {invite ? null : (
            <fieldset className="grid gap-3">
              <legend className="text-lg font-semibold">Account type</legend>
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg font-medium">
                <input defaultChecked name="appRole" type="radio" value="parent" />
                Parent
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg font-medium">
                <input name="appRole" type="radio" value="child" />
                Child
              </label>
            </fieldset>
          )}

          <button className="min-h-12 rounded-2xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
            Create account
          </button>
        </form>
    </AuthFrame>
  );
}
