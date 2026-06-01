import Image from "next/image";
import Link from "next/link";
import { signInAction } from "@/app/auth/actions";
import { PasswordField } from "@/components/password-field";
import { AppShell } from "@/components/ui";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AppShell className="max-w-3xl" variant="web">
      <section className="grid min-h-[calc(100dvh-2rem)] content-center gap-8 py-8">
        <header className="grid gap-2">
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
          <h1 className="text-3xl font-semibold leading-tight">Sign in</h1>
          <p className="max-w-xl text-lg text-[var(--muted)]">
            Use the email and password for your account.
          </p>
        </header>

        {params.error ? (
          <p className="rounded-2xl border border-[var(--danger)] bg-[var(--surface-elevated)] p-4 text-lg font-medium text-[var(--danger)]">
            {params.error}
          </p>
        ) : null}

        <form action={signInAction} className="grid max-w-md gap-4">
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

        <p className="text-lg text-[var(--muted)]">
          Need an account?{" "}
          <Link className="font-semibold text-[var(--accent-strong)]" href="/sign-up">
            Create one
          </Link>
        </p>
      </section>
    </AppShell>
  );
}
