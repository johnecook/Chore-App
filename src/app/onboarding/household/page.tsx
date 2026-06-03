import Image from "next/image";
import { redirect } from "next/navigation";
import { createHouseholdAction } from "@/app/onboarding/actions";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell } from "@/components/ui";
import { currentUserHasHousehold, requireCurrentProfile } from "@/lib/auth/session";

const weekdays = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export const dynamic = "force-dynamic";

export default async function HouseholdOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [profile, hasHousehold, params] = await Promise.all([
    requireCurrentProfile(),
    currentUserHasHousehold(),
    searchParams,
  ]);

  if (profile.appRole === "child") {
    redirect("/kid");
  }

  if (hasHousehold) {
    redirect("/parent");
  }

  return (
    <AppShell variant="web">
      <section className="grid min-h-[calc(100dvh-2rem)] content-center gap-8 py-8">
        <header className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-lg font-semibold text-white">
              <Image
                alt=""
                aria-hidden="true"
                className="h-12 w-12"
                height={48}
                priority
                src="/brand/rhythm-icon.svg"
                width={48}
              />
              Rhythm
            </div>
            <SignOutButton />
          </div>
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold leading-tight">Set up your household</h1>
            <p className="max-w-xl text-lg text-[var(--muted)]">
              {profile.displayName}, start with one household. Money and payouts are optional.
            </p>
          </div>
        </header>

        {params.error ? (
          <p className="rounded-2xl border border-[var(--danger)] bg-[var(--surface-elevated)] p-4 text-lg font-medium text-[var(--danger)]">
            {params.error}
          </p>
        ) : null}

        <form action={createHouseholdAction} className="grid max-w-xl gap-4">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold">Create a household</h2>
            <p className="text-base text-[var(--muted)]">
              Use this if you are setting up chores, routines, and optional payouts for your household.
            </p>
          </div>

          <label className="grid gap-2 text-lg font-semibold">
            Household name
            <input
              className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
              defaultValue="Cook Household"
              name="householdName"
              required
              type="text"
            />
          </label>

          <label className="grid gap-2 text-lg font-semibold">
            Timezone
            <select
              className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
              defaultValue="America/Chicago"
              name="householdTimezone"
            >
              <option value="America/Chicago">Central time</option>
              <option value="America/New_York">Eastern time</option>
              <option value="America/Denver">Mountain time</option>
              <option value="America/Los_Angeles">Pacific time</option>
            </select>
          </label>

          <fieldset className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4">
            <legend className="text-lg font-semibold">Chores and money</legend>
            <label className="flex items-start gap-3 text-lg font-semibold">
              <input
                className="mt-2 size-5"
                name="moneyMode"
                type="radio"
                value="none"
              />
              <span className="grid gap-1">
                <span>No paid chores</span>
                <span className="text-base font-normal text-[var(--muted)]">
                  Use Rhythm for chores and routines without payouts or allowance tracking.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-lg font-semibold">
              <input
                className="mt-2 size-5"
                defaultChecked
                name="moneyMode"
                type="radio"
                value="per_chore"
              />
              <span className="grid gap-1">
                <span>Chores with individual amounts</span>
                <span className="text-base font-normal text-[var(--muted)]">
                  New chores default to a fixed payout amount, with unpaid chores still available.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-lg font-semibold">
              <input
                className="mt-2 size-5"
                name="moneyMode"
                type="radio"
                value="allowance_plus_bonus"
              />
              <span className="grid gap-1">
                <span>Allowance plus extra payouts</span>
                <span className="text-base font-normal text-[var(--muted)]">
                  New chores default to included in allowance, with bonus payouts available for extras.
                </span>
              </span>
            </label>
          </fieldset>

          <label className="grid gap-2 text-lg font-semibold">
            Payout schedule
            <select
              className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
              defaultValue="biweekly"
              name="payCycle"
            >
              <option value="biweekly">Every two weeks</option>
              <option value="weekly">Every week</option>
            </select>
          </label>

          <label className="grid gap-2 text-lg font-semibold">
            Payout day
            <select
              className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
              defaultValue={5}
              name="payWeekday"
            >
              {weekdays.map((weekday) => (
                <option key={weekday.value} value={weekday.value}>
                  {weekday.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-lg font-semibold">
            First payout date
            <input
              className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
              name="biweeklyAnchorDate"
              type="date"
            />
          </label>

          <button className="min-h-12 rounded-2xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
            Create household
          </button>
        </form>
      </section>
    </AppShell>
  );
}
