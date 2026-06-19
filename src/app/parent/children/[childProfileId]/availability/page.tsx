import Link from "next/link";
import { redirect } from "next/navigation";
import {
  deleteAvailabilityOverrideAction,
  saveAvailabilityOverrideAction,
  saveAvailabilityWindowAction,
} from "@/app/parent/children/[childProfileId]/availability/actions";
import { ParentNav } from "@/components/parent-nav";
import { AppShell } from "@/components/ui";
import { requireCurrentParentHouseholdId, requireCurrentProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const weekOffsets = Array.from({ length: 14 }, (_, index) => index);

function describePattern(window: {
  cycle_length_days: number;
  available_day_offsets: number[];
} | null) {
  if (!window) {
    return "No pattern set";
  }

  if (window.cycle_length_days === 1 && window.available_day_offsets.includes(0)) {
    return "Every day";
  }

  if (
    window.cycle_length_days === 14 &&
    window.available_day_offsets.length === 7 &&
    window.available_day_offsets.every((offset) => offset >= 0 && offset <= 6)
  ) {
    return "Week on, week off";
  }

  return `${window.available_day_offsets.length} of ${window.cycle_length_days} days`;
}

export const dynamic = "force-dynamic";

export default async function ChildAvailabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ childProfileId: string }>;
  searchParams: Promise<{ error?: string; returnLabel?: string; returnTo?: string; saved?: string }>;
}) {
  const [profile, householdId, routeParams, query] = await Promise.all([
    requireCurrentProfile(),
    requireCurrentParentHouseholdId(),
    params,
    searchParams,
  ]);

  if (profile.appRole === "child") {
    redirect("/kid");
  }

  const supabase = await createSupabaseServerClient();
  const { data: childProfile, error: childError } = await supabase
    .from("child_profiles")
    .select("id, user_id")
    .eq("id", routeParams.childProfileId)
    .maybeSingle();

  if (childError) {
    throw new Error(childError.message);
  }

  if (!childProfile) {
    redirect("/parent/household");
  }

  const [{ data: childUser, error: profileError }, { data: availabilityWindow, error: windowError }, { data: overrides, error: overrideError }] =
    await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", childProfile.user_id).maybeSingle(),
      supabase
        .from("child_household_availability_windows")
        .select("id, anchor_date, cycle_length_days, available_day_offsets")
        .eq("child_profile_id", childProfile.id)
        .eq("household_id", householdId)
        .maybeSingle(),
      supabase
        .from("child_household_availability_overrides")
        .select("id, override_date, available, reason")
        .eq("child_profile_id", childProfile.id)
        .eq("household_id", householdId)
        .order("override_date", { ascending: true }),
    ]);

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (windowError) {
    throw new Error(windowError.message);
  }

  if (overrideError) {
    throw new Error(overrideError.message);
  }

  const childName = childUser?.display_name ?? "Child";
  const returnTo =
    query.returnTo?.startsWith("/") && !query.returnTo.startsWith("//")
      ? query.returnTo
      : "/parent/household";
  const returnLabel = query.returnLabel?.trim() || "Household";

  return (
    <AppShell variant="web">
        <header className="grid gap-4">
          <ParentNav />
          <div className="grid gap-2">
            <nav aria-label="Breadcrumb">
              <Link className="text-base font-semibold text-[var(--accent-strong)]" href={returnTo}>
                Back to {returnLabel}
              </Link>
            </nav>
            <h1 className="text-3xl font-semibold leading-tight">{childName}</h1>
            <p className="max-w-xl text-lg text-[var(--muted)]">
              Set when this child is available for chores in this household.
            </p>
          </div>
        </header>

        {query.error ? (
          <p className="rounded-2xl border border-[var(--danger)] bg-[var(--surface-elevated)] p-4 text-lg font-medium text-[var(--danger)]">
            {query.error}
          </p>
        ) : null}

        {query.saved ? (
          <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 text-lg font-medium">
            Availability updated.
          </p>
        ) : null}

        <section aria-labelledby="pattern-heading" className="grid gap-4">
          <div className="grid gap-1">
            <h2 id="pattern-heading" className="text-xl font-semibold">
              Base pattern
            </h2>
            <p className="text-base text-[var(--muted)]">{describePattern(availabilityWindow)}</p>
          </div>

          <form action={saveAvailabilityWindowAction} className="grid max-w-xl gap-4">
            <input name="childProfileId" type="hidden" value={childProfile.id} />
            <input name="returnLabel" type="hidden" value={returnLabel} />
            <input name="returnTo" type="hidden" value={returnTo} />

            <label className="grid gap-2 text-lg font-semibold">
              Anchor date
              <input
                className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
                defaultValue={availabilityWindow?.anchor_date ?? new Date().toISOString().slice(0, 10)}
                name="anchorDate"
                required
                type="date"
              />
            </label>

            <fieldset className="grid gap-3">
              <legend className="text-lg font-semibold">Pattern</legend>
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg font-medium">
                <input defaultChecked={!availabilityWindow} name="pattern" type="radio" value="week_on_week_off" />
                Week on, week off
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg font-medium">
                <input name="pattern" type="radio" value="every_day" />
                Every day
              </label>
              <label className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg font-medium">
                <span className="flex items-center gap-3">
                  <input name="pattern" type="radio" value="custom" />
                  Custom 14-day cycle
                </span>
                <input name="cycleLengthDays" type="hidden" value={14} />
                <span className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {weekOffsets.map((offset) => (
                    <label className="flex items-center gap-2 text-base font-medium" key={offset}>
                      <input
                        defaultChecked={availabilityWindow?.available_day_offsets.includes(offset)}
                        name="availableDayOffsets"
                        type="checkbox"
                        value={offset}
                      />
                      Day {offset + 1}
                    </label>
                  ))}
                </span>
              </label>
            </fieldset>

            <button className="min-h-12 rounded-2xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
              Save pattern
            </button>
          </form>
        </section>

        <section aria-labelledby="override-heading" className="grid gap-4">
          <div className="grid gap-1">
            <h2 id="override-heading" className="text-xl font-semibold">
              Overrides
            </h2>
            <p className="text-base text-[var(--muted)]">Use these for summer, holidays, or one-off changes.</p>
          </div>

          <form action={saveAvailabilityOverrideAction} className="grid max-w-xl gap-4">
            <input name="childProfileId" type="hidden" value={childProfile.id} />
            <input name="returnLabel" type="hidden" value={returnLabel} />
            <input name="returnTo" type="hidden" value={returnTo} />
            <label className="grid gap-2 text-lg font-semibold">
              Date
              <input
                className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
                name="overrideDate"
                required
                type="date"
              />
            </label>
            <label className="grid gap-2 text-lg font-semibold">
              Availability
              <select
                className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
                name="available"
              >
                <option value="true">Available</option>
                <option value="false">Not available</option>
              </select>
            </label>
            <label className="grid gap-2 text-lg font-semibold">
              Reason
              <input
                className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
                name="reason"
                type="text"
              />
            </label>
            <button className="min-h-12 rounded-2xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white">
              Add override
            </button>
          </form>

          <div className="grid gap-3">
            {overrides?.length ? (
              overrides.map((override) => (
                <article className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4" key={override.id}>
                  <div className="grid gap-1">
                    <h3 className="text-xl font-semibold leading-snug">{override.override_date}</h3>
                    <p className="text-base text-[var(--muted)]">
                      {override.available ? "Available" : "Not available"}
                      {override.reason ? ` - ${override.reason}` : ""}
                    </p>
                  </div>
                  <form action={deleteAvailabilityOverrideAction}>
                    <input name="childProfileId" type="hidden" value={childProfile.id} />
                    <input name="overrideId" type="hidden" value={override.id} />
                    <input name="returnLabel" type="hidden" value={returnLabel} />
                    <input name="returnTo" type="hidden" value={returnTo} />
                    <button className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg font-semibold">
                      Delete
                    </button>
                  </form>
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 text-lg text-[var(--muted)]">
                No overrides yet.
              </p>
            )}
          </div>
        </section>
    </AppShell>
  );
}
