import Image from "next/image";
import { AppShell, ButtonLink, Card } from "@/components/ui";

export default function HomePage() {
  return (
    <AppShell className="max-w-5xl" variant="web">
      <section className="grid min-h-[calc(100dvh-8rem)] content-center gap-8 py-8">
        <div className="flex flex-wrap items-center gap-4">
          <Image
            alt=""
            aria-hidden="true"
            className="h-24 w-24"
            height={96}
            priority
            src="/brand/rhythm-icon.svg"
            width={96}
          />
          <div className="grid gap-1">
            <p className="text-4xl font-semibold leading-none text-white">Rhythm</p>
            <p className="text-sm font-semibold text-[var(--accent-strong)]">
              Build responsibility together
            </p>
          </div>
        </div>
        <div className="grid max-w-3xl gap-3">
          <h1 className="text-balance text-4xl font-semibold leading-tight sm:text-5xl">
            Build responsibility together.
          </h1>
          <p className="text-xl text-[var(--muted)]">
            A calm workspace for family routines, chores, approvals, and optional money tracking.
          </p>
        </div>

        <nav aria-label="Choose role" className="grid gap-3 sm:max-w-md">
          <ButtonLink href="/sign-in">
            Sign in
          </ButtonLink>
          <ButtonLink href="/sign-up" variant="secondary">
            Create account
          </ButtonLink>
        </nav>

        <Card as="div" className="max-w-2xl">
          <p className="text-lg text-[var(--muted)]">
            Designed for quick daily check-ins, large text, and clear family expectations without
            gamification or visual noise.
          </p>
        </Card>
      </section>
    </AppShell>
  );
}
