import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

export function ParentNav() {
  return (
    <nav aria-label="Parent navigation" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="text-base font-semibold text-[var(--accent-strong)]" href="/parent">
          Chores
        </Link>
        <SignOutButton />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Link
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-center text-base font-semibold"
          href="/parent"
        >
          Dashboard
        </Link>
        <Link
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-center text-base font-semibold"
          href="/parent/household"
        >
          Household
        </Link>
        <Link
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-center text-base font-semibold"
          href="/notifications"
        >
          Notifications
        </Link>
        <Link
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-center text-base font-semibold"
          href="/parent/chores/new"
        >
          Add chore
        </Link>
      </div>
    </nav>
  );
}
