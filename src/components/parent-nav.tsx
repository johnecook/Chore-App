import Image from "next/image";
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
  const primaryItems = [
    { href: "/parent", label: "Dashboard" },
    { href: "/parent/chores", label: "Chores" },
    { href: "/parent/history", label: "History" },
    { href: "/parent/money", label: "Money" },
  ];

  return (
    <nav
      aria-label="Parent navigation"
      className="rounded-[24px] border border-white/10 bg-[#06133A]/78 p-2 shadow-[0_18px_48px_rgba(0,0,0,0.22)] backdrop-blur"
    >
      <div className="flex items-center gap-2">
        <Link
          className="mr-auto flex min-h-14 items-center gap-3 rounded-2xl px-3 text-lg font-semibold text-white"
          href="/parent"
        >
          <Image
            alt=""
            aria-hidden="true"
            className="h-12 w-12 shrink-0"
            height={48}
            src="/brand/rhythm-icon.svg"
            width={48}
          />
          Rhythm
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {primaryItems.map((item) => (
            <Link
              className="flex min-h-11 items-center rounded-2xl px-4 text-sm font-semibold text-[var(--muted)] transition hover:bg-white/8 hover:text-white"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
          <Link
            className="flex min-h-11 items-center rounded-2xl px-4 text-sm font-semibold text-[var(--muted)] transition hover:bg-white/8 hover:text-white"
            href="/notifications"
          >
            Notifications{unreadCount ? ` (${unreadCount})` : ""}
          </Link>
        </div>
        <details className="relative">
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-2xl border border-white/10 bg-white/8 px-4 text-sm font-semibold text-white">
            Menu
          </summary>
          <div className="absolute right-0 top-14 z-40 grid min-w-56 gap-1 rounded-3xl border border-white/10 bg-[#06133A] p-2 shadow-[0_22px_60px_rgba(0,0,0,0.36)]">
            {[
              ...primaryItems,
              { href: "/notifications", label: `Notifications${unreadCount ? ` (${unreadCount})` : ""}` },
              { href: "/parent/household", label: "Household" },
            ].map((item) => (
              <Link
                className="rounded-2xl px-4 py-3 text-base font-semibold text-[var(--muted)]"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-1 border-t border-white/10 pt-2">
              <SignOutButton variant="menu-item" />
            </div>
          </div>
        </details>
      </div>
    </nav>
  );
}
