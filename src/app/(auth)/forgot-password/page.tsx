import Link from "next/link";
import { requestPasswordResetAction } from "@/app/auth/actions";
import { AuthFrame } from "@/components/auth-frame";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthFrame
      footer={
        <>
          Remember your password?{" "}
          <Link className="font-semibold text-[var(--accent-strong)]" href="/sign-in">
            Sign in
          </Link>
        </>
      }
      intro="Enter the email for your Rhythm account and we will send a reset link."
      title="Reset password"
    >
      {params.error ? (
        <p className="rounded-2xl border border-[var(--danger)] bg-[var(--surface-elevated)] p-4 text-lg font-medium text-[var(--danger)]">
          {params.error}
        </p>
      ) : null}

      {params.sent ? (
        <div className="grid gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-4 text-base text-[var(--muted)]">
          <p>Check your email for a password reset link.</p>
          <p className="break-anywhere font-semibold text-white">{params.sent}</p>
        </div>
      ) : (
        <form action={requestPasswordResetAction} className="grid gap-4">
          <label className="grid gap-2 text-lg font-semibold">
            Email
            <input
              autoComplete="email"
              className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
              name="email"
              required
              type="email"
            />
          </label>

          <button className="min-h-12 rounded-2xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
            Send reset link
          </button>
        </form>
      )}
    </AuthFrame>
  );
}
