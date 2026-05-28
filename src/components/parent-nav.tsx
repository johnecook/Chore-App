import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { requireCurrentProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function ParentNav() {
  const profile = await requireCurrentProfile();
  const supabase = await createSupabaseServerClient();
  const { data: unreadNotifications, error } = await supabase
    .from("notification_events")
    .select("id")
    .eq("recipient_profile_id", profile.id)
    .is("read_at", null);

  if (error) {
    throw new Error(error.message);
  }

  const unreadCount = unreadNotifications?.length ?? 0;

  return (
    <nav aria-label="Parent navigation" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="text-base font-semibold text-[var(--accent-strong)]" href="/parent">
          Chores
        </Link>
        <SignOutButton />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
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
          href="/parent/history"
        >
          History
        </Link>
        <Link
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-center text-base font-semibold"
          href="/parent/money"
        >
          Money
        </Link>
        <Link
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-center text-base font-semibold"
          href="/notifications"
        >
          Notifications{unreadCount ? ` (${unreadCount})` : ""}
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
