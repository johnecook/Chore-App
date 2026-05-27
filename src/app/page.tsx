import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="flex min-h-[calc(100dvh-2rem)] flex-col justify-center gap-8 py-8">
        <div className="grid gap-3">
          <p className="text-base font-semibold text-[var(--accent-strong)]">Chores</p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            Clear chores and routines for the family.
          </h1>
          <p className="max-w-2xl text-xl text-[var(--muted)]">
            A mobile-first workspace for kids and parents. Built for simple views,
            large text, split households, and optional money tracking.
          </p>
        </div>

        <nav aria-label="Choose role" className="grid gap-3 sm:max-w-md">
          <Link
            className="rounded-lg bg-[var(--accent)] px-5 py-4 text-lg font-semibold text-white"
            href="/sign-in"
          >
            Sign in
          </Link>
          <Link
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-lg font-semibold"
            href="/sign-up"
          >
            Create account
          </Link>
        </nav>
      </section>
    </main>
  );
}
