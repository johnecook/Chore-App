import Link from "next/link";
import type { ReactNode } from "react";

type Task = {
  action?: ReactNode;
  amount: string;
  children?: ReactNode;
  done?: boolean;
  icon: ReactNode;
  meta?: ReactNode;
  statusLabel?: string;
  title: string;
};

type Goal = {
  current: string;
  icon: ReactNode;
  progress: number;
  target: string;
  title: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AppScreen({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_30%_-10%,rgba(174,235,242,0.16),transparent_12rem),linear-gradient(180deg,#061842_0%,#07163A_58%,#04112F_100%)] text-white md:bg-[#222A59] md:px-4 md:py-4">
      <div className="mx-auto grid min-h-dvh w-full grid-rows-[auto_1fr] overflow-x-hidden bg-[radial-gradient(circle_at_30%_-10%,rgba(174,235,242,0.16),transparent_12rem),linear-gradient(180deg,#061842_0%,#07163A_58%,#04112F_100%)] pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:min-h-[calc(100dvh-2rem)] md:max-w-[390px] md:grid-rows-[auto_1fr_auto] md:overflow-hidden md:rounded-[24px] md:pb-0 md:shadow-[0_26px_80px_rgba(2,7,28,0.42)]">
        {children}
      </div>
    </main>
  );
}

export function HeaderGreeting({
  action,
  initial = "W",
  name = "Will!",
}: {
  action?: ReactNode;
  initial?: string;
  name?: string;
}) {
  return (
    <header className="px-5 pb-4 pt-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#6EDC7A,#AEEBF2)] p-1 shadow-[0_10px_22px_rgba(0,0,0,0.28)]">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-[#183064] text-2xl font-semibold">
              {initial}
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-base leading-snug text-white/90">Good morning,</p>
            <h1 className="break-words text-[32px] font-bold leading-tight tracking-normal">{name}</h1>
          </div>
        </div>
        {action ?? (
          <button
            aria-label="Notifications"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-xl text-white"
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M15.5 18a3.5 3.5 0 0 1-7 0M5.5 16.5h13l-1.6-2.3V10a4.9 4.9 0 0 0-9.8 0v4.2l-1.6 2.3Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}

export function SegmentedControl({
  items,
}: {
  items: Array<{ href?: string; label: string; onSelect?: () => void; selected?: boolean }>;
}) {
  return (
    <div
      className="grid gap-1 rounded-[16px] bg-white/[0.08] p-1"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const className = cx(
          "flex min-h-10 items-center justify-center rounded-[14px] px-3 text-center text-sm font-semibold",
          item.selected ? "bg-white text-[#071743]" : "text-white",
        );

        return item.href ? (
          <Link className={className} href={item.href} key={item.label}>
            {item.label}
          </Link>
        ) : (
          <button className={className} key={item.label} onClick={item.onSelect} type="button">
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function SectionHeader({
  action,
  title,
}: {
  action?: ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-base font-bold leading-snug text-white">{title}</h2>
      {action ? <div className="text-sm font-medium text-white">{action}</div> : null}
    </div>
  );
}

export function Button({ children }: { children: ReactNode }) {
  return (
    <button
      className="min-h-12 rounded-[16px] bg-[#0F6EA4] px-5 py-3 text-center text-lg font-bold text-white shadow-[0_12px_24px_rgba(2,7,28,0.24)]"
      type="submit"
    >
      {children}
    </button>
  );
}

export function TaskRow({ action, amount, children, done, icon, meta, statusLabel, title }: Task) {
  return (
    <div className="border-b border-white/[0.08] px-1 py-2.5 last:border-b-0">
      <div className="grid grid-cols-[44px_1fr_auto] items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFFFFF,#CFEFFF)] text-2xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="break-words text-base font-bold leading-snug text-white">{title}</p>
          <p className="text-sm font-semibold leading-snug text-white/85">
            {amount}
            {meta ? <span className="font-medium text-white/60"> · {meta}</span> : null}
          </p>
        </div>
        {action ?? (done ? (
          <div
            aria-label={statusLabel ?? "Done"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[#45F1F1] bg-[#45F1F1] text-[#061842]"
          >
            ✓
          </div>
        ) : null)}
      </div>
      {children ? <div className="mt-3 pl-[56px]">{children}</div> : null}
    </div>
  );
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

export function BalanceCard({
  balanceCents = 1250,
  href,
}: {
  balanceCents?: number;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-base font-bold text-white">My balance</p>
          <p className="mt-1 text-[32px] font-bold leading-none text-white">{formatMoney(balanceCents)}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#AEEBF2] text-3xl text-[#061842]">
            ▰
          </div>
          <span className="text-3xl leading-none text-white">›</span>
        </div>
      </div>
    </>
  );

  return (
    <section className="rounded-[18px] bg-[linear-gradient(135deg,#263AA4,#0B5C93)] p-4 shadow-[0_16px_34px_rgba(2,7,28,0.28)]">
      {href ? <Link href={href}>{content}</Link> : content}
    </section>
  );
}

export function GoalCard({ current, icon, progress, target, title }: Goal) {
  return (
    <article className="grid grid-cols-[58px_1fr] items-center gap-4 rounded-[18px] bg-[linear-gradient(145deg,rgba(43,59,120,0.98),rgba(12,37,90,0.98))] p-4 shadow-[0_16px_34px_rgba(2,7,28,0.22)]">
      <div className="text-[42px] leading-none text-[#AEEBF2]">{icon}</div>
      <div className="min-w-0">
        <h3 className="break-words text-base font-bold leading-snug text-white">{title}</h3>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/[0.14]">
          <div className="h-full rounded-full bg-[#3CEBFF]" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-sm font-semibold text-white/75">
          <span className="text-[#AEEBF2]">{current}</span> / {target}
        </p>
      </div>
    </article>
  );
}

export function BottomTabBar({ active = "Today" }: { active?: "Today" | "History" | "Money" | "More" | "Tasks" }) {
  const tabs = [
    { href: "/kid", icon: "▣", label: "Today" },
    { href: "/kid", icon: "□", label: "Tasks" },
    { href: "/kid/history", icon: "◎", label: "History" },
    { href: "/kid/money", icon: "$", label: "Money" },
    { href: "/notifications", icon: "…", label: "More" },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full border-t border-white/[0.08] bg-[#06133A]/95 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 shadow-[0_-18px_48px_rgba(0,0,0,0.28)] md:static md:max-w-none md:pb-3 md:shadow-none"
      aria-label="Primary"
    >
      <div className="grid grid-cols-5 gap-1">
        {tabs.map((tab) => (
          <Link
            className={cx(
              "grid min-h-12 place-items-center content-center gap-1 rounded-2xl text-xs font-semibold",
              tab.label === active ? "text-[#2CEBFF]" : "text-white/70",
            )}
            href={tab.href}
            key={tab.label}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function ChildTodayStaticScreen() {
  const tasks: Task[] = [
    { amount: "$1.00", done: true, icon: "▭", title: "Make bed" },
    { amount: "$1.50", done: true, icon: "♲", title: "Take out trash" },
    { amount: "$1.00", icon: "●", title: "Feed the dog" },
    { amount: "$2.00", icon: "▰", title: "Clean your room" },
    { amount: "$2.00", icon: "□", title: "Homework" },
  ];

  return (
    <AppScreen>
      <div>
        <HeaderGreeting />
        <div className="grid gap-5 px-5 pb-5">
          <SegmentedControl
            items={[
              { label: "Today", selected: true },
              { label: "This Week" },
            ]}
          />

          <section className="grid gap-2">
            <SectionHeader action="2 of 5 done" title="My tasks" />
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.10]">
              <div className="h-full w-[40%] rounded-full bg-[#45F1F1]" />
            </div>
            <div className="rounded-[20px] bg-[linear-gradient(145deg,rgba(43,59,120,0.96),rgba(11,36,88,0.96))] px-3 py-1 shadow-[0_16px_34px_rgba(2,7,28,0.22)]">
              {tasks.map((task) => (
                <TaskRow key={task.title} {...task} />
              ))}
            </div>
          </section>

          <BalanceCard />
        </div>
      </div>
      <BottomTabBar />
    </AppScreen>
  );
}
