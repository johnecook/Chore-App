import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type Tone = "default" | "success" | "warning" | "danger" | "accent";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AppShell({
  actions,
  children,
  className,
  eyebrow,
  variant = "mobile",
  title,
  subtitle,
}: {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  variant?: "mobile" | "web";
}) {
  const isWeb = variant === "web";

  return (
    <main className={cn("page-shell", isWeb ? "max-w-7xl" : "max-w-[430px]", className)}>
      <div
        className={cn(
          isWeb
            ? "grid min-h-dvh gap-6 py-5 sm:py-8"
            : "rhythm-panel grid min-h-dvh gap-6 px-5 pb-28 pt-5 sm:my-4 sm:min-h-[calc(100dvh-2rem)] sm:px-6",
        )}
      >
        {(eyebrow || title || subtitle || actions) && (
          <header className="grid gap-4">
            {actions ? (
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{actions}</div>
            ) : null}
            {(eyebrow || title || subtitle) && (
              <div className="grid gap-1">
                {eyebrow ? (
                  <p className="text-base font-medium text-white/90">{eyebrow}</p>
                ) : null}
                {title ? (
                  <h1 className="text-balance text-3xl font-semibold leading-tight tracking-normal text-white">
                    {title}
                  </h1>
                ) : null}
                {subtitle ? <p className="text-base text-[var(--muted)]">{subtitle}</p> : null}
              </div>
            )}
          </header>
        )}
        {children}
      </div>
    </main>
  );
}

export function Card({
  as = "article",
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: "article" | "section" | "div";
}) {
  const Component = as;

  return (
    <Component className={cn("rhythm-card grid gap-3 p-4 sm:p-5", className)} {...props}>
      {children}
    </Component>
  );
}

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <button
      className={cn(
        "rhythm-control inline-flex items-center justify-center px-5 py-3 text-center text-lg font-semibold transition disabled:opacity-60",
        variant === "primary" && "bg-[#0F6EA4] text-white shadow-[var(--shadow-card)]",
        variant === "secondary" && "border border-[var(--line)] bg-white/8 text-[var(--foreground)]",
        variant === "danger" && "border border-[var(--danger)] bg-transparent text-[var(--danger)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  className,
  variant = "primary",
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      className={cn(
        "rhythm-control inline-flex items-center justify-center px-5 py-3 text-center text-lg font-semibold transition",
        variant === "primary" && "bg-[#0F6EA4] text-white shadow-[var(--shadow-card)]",
        variant === "secondary" && "border border-[var(--line)] bg-white/8 text-[var(--foreground)]",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

export function StatusPill({
  children,
  className,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 max-w-full items-center rounded-full border px-3 py-1 text-sm font-semibold leading-snug",
        tone === "default" && "border-[var(--line)] bg-[var(--surface-soft)] text-[var(--muted)]",
        tone === "accent" && "border-[var(--accent-strong)] bg-[rgba(174,235,242,0.12)] text-[var(--accent-strong)]",
        tone === "success" && "border-[var(--success)] bg-[rgba(184,243,212,0.12)] text-[var(--success)]",
        tone === "warning" && "border-[var(--warning)] bg-[rgba(255,224,163,0.12)] text-[var(--warning)]",
        tone === "danger" && "border-[var(--danger)] bg-[rgba(255,180,180,0.12)] text-[var(--danger)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  action,
  children,
  title,
}: {
  action?: ReactNode;
  children?: ReactNode;
  title: ReactNode;
}) {
  return (
    <Card as="div" className="items-start">
      <div className="grid gap-1">
        <p className="text-xl font-semibold">{title}</p>
        {children ? <div className="text-lg text-[var(--muted)]">{children}</div> : null}
      </div>
      {action}
    </Card>
  );
}

export function MoneyAmount({
  cents,
  className,
  showSign = false,
}: {
  cents: number;
  className?: string;
  showSign?: boolean;
}) {
  const value = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);

  return (
    <span className={cn("tabular-nums", className)}>
      {showSign && cents > 0 ? "+" : ""}
      {value}
    </span>
  );
}

export function TaskRow({
  action,
  amountCents,
  children,
  className,
  icon,
  meta,
  status,
  statusTone = "default",
  title,
  ...props
}: HTMLAttributes<HTMLElement> & {
  action?: ReactNode;
  amountCents?: number;
  children?: ReactNode;
  className?: string;
  icon?: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  statusTone?: Tone;
  title: ReactNode;
}) {
  return (
    <Card as="article" className={cn("gap-0 overflow-hidden p-0", className)} {...props}>
      <div className="rhythm-row flex min-w-0 items-center gap-3 p-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(174,235,242,0.95),rgba(15,92,140,0.85))] text-xl font-semibold text-[#061842]">
          {icon ?? <span>{typeof title === "string" ? title.slice(0, 1) : "•"}</span>}
        </div>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h3 className="break-anywhere text-base font-semibold leading-snug text-white">{title}</h3>
          {meta ? <p className="text-base text-[var(--muted)]">{meta}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {amountCents !== undefined ? (
            <MoneyAmount cents={amountCents} className="text-base font-semibold text-[var(--accent-strong)]" />
          ) : null}
          {status ? <StatusPill tone={statusTone}>{status}</StatusPill> : null}
        </div>
      </div>
      {children ? <div className="grid gap-3 p-3 pt-0">{children}</div> : null}
      {action}
    </Card>
  );
}

export function SegmentedControl({
  items,
}: {
  items: Array<{ label: string; selected?: boolean }>;
}) {
  return (
    <div className="grid grid-flow-col gap-1 rounded-2xl bg-white/8 p-1">
      {items.map((item) => (
        <span
          className={cn(
            "flex min-h-10 items-center justify-center rounded-xl px-3 text-center text-sm font-semibold",
            item.selected ? "bg-white text-[#071743]" : "text-white",
          )}
          key={item.label}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="grid gap-2 border-r border-white/10 px-3 last:border-r-0 first:pl-0 last:pr-0">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-[var(--accent-strong)]">
        {icon}
      </div>
      <p className="text-2xl font-semibold leading-none text-white">{value}</p>
      <p className="text-xs font-semibold text-[var(--muted)]">{label}</p>
    </div>
  );
}
