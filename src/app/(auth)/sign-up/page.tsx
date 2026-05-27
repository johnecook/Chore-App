import Link from "next/link";
import { signUpAction } from "@/app/auth/actions";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="page-shell">
      <section className="grid min-h-[calc(100dvh-2rem)] content-center gap-8 py-8">
        <header className="grid gap-2">
          <Link className="text-base font-semibold text-[var(--accent-strong)]" href="/">
            Chores
          </Link>
          <h1 className="text-3xl font-semibold leading-tight">Create account</h1>
          <p className="max-w-xl text-lg text-[var(--muted)]">
            Start with email and password. Parent-managed child sign-in can fit this account model later.
          </p>
        </header>

        {params.error ? (
          <p className="rounded-lg border border-[var(--danger)] bg-white p-4 text-lg font-medium text-[var(--danger)]">
            {params.error}
          </p>
        ) : null}

        <form action={signUpAction} className="grid max-w-md gap-4">
          <label className="grid gap-2 text-lg font-semibold">
            Name
            <input
              autoComplete="name"
              className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
              name="displayName"
              required
              type="text"
            />
          </label>

          <label className="grid gap-2 text-lg font-semibold">
            Email
            <input
              autoComplete="email"
              className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
              name="email"
              required
              type="email"
            />
          </label>

          <label className="grid gap-2 text-lg font-semibold">
            Password
            <input
              autoComplete="new-password"
              className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg"
              minLength={8}
              name="password"
              required
              type="password"
            />
          </label>

          <fieldset className="grid gap-3">
            <legend className="text-lg font-semibold">Account type</legend>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg font-medium">
              <input defaultChecked name="appRole" type="radio" value="parent" />
              Parent
            </label>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-lg font-medium">
              <input name="appRole" type="radio" value="child" />
              Child
            </label>
          </fieldset>

          <button className="min-h-12 rounded-lg bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
            Create account
          </button>
        </form>

        <p className="text-lg text-[var(--muted)]">
          Already have an account?{" "}
          <Link className="font-semibold text-[var(--accent-strong)]" href="/sign-in">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
