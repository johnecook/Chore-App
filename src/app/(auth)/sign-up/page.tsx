import Link from "next/link";
import { signUpAction } from "@/app/auth/actions";
import { AuthFrame } from "@/components/auth-frame";
import { PasswordField } from "@/components/password-field";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthFrame
      footer={
        <>
          Already have an account?{" "}
          <Link className="font-semibold text-[var(--accent-strong)]" href="/sign-in">
            Sign in
          </Link>
        </>
      }
      intro="Start with email and password. Parent-managed child sign-in can fit this account model later."
      title="Create account"
    >
        {params.error ? (
          <p className="rounded-2xl border border-[var(--danger)] bg-[var(--surface-elevated)] p-4 text-lg font-medium text-[var(--danger)]">
            {params.error}
          </p>
        ) : null}

        <form action={signUpAction} className="grid gap-4">
          <label className="grid gap-2 text-lg font-semibold">
            Name
            <input
              autoComplete="name"
              className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
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
              name="email"
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

          <button className="min-h-12 rounded-2xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
            Create account
          </button>
        </form>
    </AuthFrame>
  );
}
