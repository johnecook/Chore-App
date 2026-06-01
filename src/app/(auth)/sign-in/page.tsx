import Link from "next/link";
import { signInAction } from "@/app/auth/actions";
import { AuthFrame } from "@/components/auth-frame";
import { PasswordField } from "@/components/password-field";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthFrame
      footer={
        <>
          Need an account?{" "}
          <Link className="font-semibold text-[var(--accent-strong)]" href="/sign-up">
            Create one
          </Link>
        </>
      }
      intro="Use the email and password for your account."
      title="Sign in"
    >
        {params.error ? (
          <p className="rounded-2xl border border-[var(--danger)] bg-[var(--surface-elevated)] p-4 text-lg font-medium text-[var(--danger)]">
            {params.error}
          </p>
        ) : null}

        <form action={signInAction} className="grid gap-4">
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

          <PasswordField autoComplete="current-password" label="Password" name="password" />

          <button className="min-h-12 rounded-2xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
            Sign in
          </button>
        </form>
    </AuthFrame>
  );
}
