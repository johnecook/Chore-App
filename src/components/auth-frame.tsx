import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell, Card } from "@/components/ui";

export function AuthFrame({
  children,
  footer,
  intro,
  title,
}: {
  children: ReactNode;
  footer: ReactNode;
  intro: ReactNode;
  title: ReactNode;
}) {
  return (
    <AppShell className="max-w-5xl" variant="web">
      <section className="grid min-h-dvh content-start gap-6 py-5 sm:gap-8 sm:py-8">
        <header className="rhythm-card grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:p-7">
          <Link
            aria-label="Rhythm home"
            className="flex h-20 w-20 items-center justify-center rounded-[24px] border border-white/10 bg-[#06133A]/72 shadow-[0_16px_42px_rgba(2,7,28,0.26)]"
            href="/"
          >
            <Image
              alt=""
              aria-hidden="true"
              className="h-14 w-14"
              height={56}
              priority
              src="/brand/rhythm-icon.svg"
              width={56}
            />
          </Link>
          <div className="grid gap-1">
            <p className="text-lg font-semibold text-white">Rhythm</p>
            <h1 className="text-balance text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Build responsibility together.
            </h1>
            <p className="max-w-2xl text-base text-[var(--muted)]">
              A calm family space for chores, approvals, routines, and optional money tracking.
            </p>
          </div>
        </header>

        <div className="grid justify-items-center">
          <Card as="section" className="w-full max-w-[31rem] gap-6 p-5 sm:p-6">
            <header className="grid gap-2">
              <h2 className="text-3xl font-semibold leading-tight text-white">{title}</h2>
              <p className="text-base text-[var(--muted)]">{intro}</p>
            </header>
            {children}
            <div className="text-base text-[var(--muted)]">{footer}</div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
