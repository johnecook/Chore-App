"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type BottomTabItem = {
  href: string;
  icon?: string;
  label: string;
};

const defaultTabs: BottomTabItem[] = [
  { href: "/kid", icon: "✓", label: "Today" },
  { href: "/kid", icon: "▣", label: "Tasks" },
  { href: "/kid/history", icon: "◎", label: "History" },
  { href: "/kid/money", icon: "$", label: "Money" },
  { href: "/notifications", icon: "…", label: "More" },
];

export function BottomTabNavigation({ items = defaultTabs }: { items?: BottomTabItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] rounded-t-[22px] border border-b-0 border-white/10 bg-[#06133A] px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 shadow-[0_-18px_48px_rgba(0,0,0,0.38)]"
    >
      <div className="grid grid-cols-5 gap-1">
        {items.map((tab) => {
          const selected = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <Link
              aria-current={selected ? "page" : undefined}
              className={`flex min-h-12 items-center justify-center rounded-2xl px-2 py-2 text-center text-sm font-semibold leading-tight ${
                selected
                  ? "text-[#2CEBFF]"
                  : "text-[var(--muted)]"
              }`}
              href={tab.href}
              key={tab.href}
            >
              <span className="grid gap-0.5">
                <span className="text-lg leading-none">{tab.icon}</span>
                <span className="text-xs leading-none">{tab.label}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
