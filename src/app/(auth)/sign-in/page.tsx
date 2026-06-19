import Link from "next/link";
import { redirect } from "next/navigation";
import { signInAction } from "@/app/auth/actions";
import { AuthFrame } from "@/components/auth-frame";
import { PasswordField } from "@/components/password-field";
import { getInviteSignupContext } from "@/lib/invitations";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string; invite?: string; next?: string }>;
}) {
  const params = await searchParams;
  const invite = await getInviteSignupContext(params.invite);
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : undefined;
  const email = params.email ?? invite?.email;
  const forgotPasswordHref = `/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`;
  const signUpParams = new URLSearchParams();

  if (invite) {
    signUpParams.set("invite", invite.id);
  }

  if (next) {
    signUpParams.set("next", next);
  }

  if (invite && !invite.accountExists) {
    redirect(`/sign-up?${signUpParams.toString()}`);
  }

  return (
    <AuthFrame
      footer={
        <>
          Need an account?{" "}
          <Link
            className="font-semibold text-[var(--accent-strong)]"
            href={`/sign-up${signUpParams.size > 0 ? `?${signUpParams.toString()}` : ""}`}
          >
            Create one
          </Link>
        </>
      }
      intro={
        invite
          ? `Sign in with ${invite.email} to accept this ${invite.role} invite.`
          : "Use the email and password for your account."
      }
      title={invite ? `Accept ${invite.role} invite` : "Sign in"}
    >
        {params.error ? (
          <div className="grid gap-2 rounded-2xl border border-[var(--danger)] bg-[var(--surface-elevated)] p-4 text-lg font-medium text-[var(--danger)]">
            <p>{params.error}</p>
            {params.error.toLowerCase().includes("credential") ? (
              <Link className="w-fit text-base font-semibold text-[var(--accent-strong)]" href={forgotPasswordHref}>
                Reset your password
              </Link>
            ) : null}
          </div>
        ) : null}

        <form action={signInAction} className="grid gap-4">
          {invite ? <input name="invitationId" type="hidden" value={invite.id} /> : null}
          {next ? <input name="next" type="hidden" value={next} /> : null}
          <label className="grid gap-2 text-lg font-semibold">
            Email
            <input
              autoComplete="email"
              className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
              defaultValue={email}
              name="email"
              required
              type="email"
            />
          </label>

          <PasswordField autoComplete="current-password" label="Password" name="password" />

          <Link className="w-fit text-base font-semibold text-[var(--accent-strong)]" href={forgotPasswordHref}>
            Forgot password?
          </Link>

          <button className="min-h-12 rounded-2xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
            Sign in
          </button>
        </form>
    </AuthFrame>
  );
}
