import Link from "next/link";
import { redirect } from "next/navigation";
import { deactivateTemplateAction } from "@/app/parent/actions";
import { ParentNav } from "@/components/parent-nav";
import { getCurrentParentHouseholdId, requireCurrentProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ParentChoresPage({
  searchParams,
}: {
  searchParams: Promise<{
    createdChore?: string;
    deactivatedTemplate?: string;
    error?: string;
    updatedTemplate?: string;
  }>;
}) {
  const [profile, householdId, params] = await Promise.all([
    requireCurrentProfile(),
    getCurrentParentHouseholdId(),
    searchParams,
  ]);

  if (profile.appRole === "child") {
    redirect("/kid");
  }

  if (!householdId) {
    redirect("/onboarding/household");
  }

  const supabase = await createSupabaseServerClient();
  const { data: choreTemplates, error: templateError } = await supabase
    .from("chore_templates")
    .select("id, title, schedule_type, active, created_at")
    .eq("household_id", householdId)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (templateError) {
    throw new Error(templateError.message);
  }

  return (
    <main className="page-shell">
      <div className="grid gap-8 py-6">
        <header className="grid gap-4">
          <ParentNav />
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid gap-2">
                <h1 className="text-3xl font-semibold leading-tight">Chores</h1>
                <p className="text-lg text-[var(--muted)]">
                  Manage recurring chore templates and one-off chore setup.
                </p>
              </div>
              <Link
                className="min-h-12 rounded-lg bg-[var(--accent)] px-5 py-3 text-center text-lg font-semibold text-white"
                href="/parent/chores/new"
              >
                Add chore
              </Link>
            </div>
          </div>
        </header>

        {params.error ? (
          <p className="rounded-lg border border-[var(--danger)] bg-white p-4 text-lg font-medium text-[var(--danger)]">
            {params.error}
          </p>
        ) : null}

        {params.createdChore ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
            Chore created.
          </p>
        ) : null}

        {params.updatedTemplate ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
            Chore template updated.
          </p>
        ) : null}

        {params.deactivatedTemplate ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
            Chore template deactivated.
          </p>
        ) : null}

        <section aria-labelledby="templates-heading" className="grid gap-3">
          <h2 id="templates-heading" className="text-xl font-semibold">
            Templates
          </h2>
          {choreTemplates?.length ? (
            <div className="grid gap-3">
              {choreTemplates.map((template) => (
                <article
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white p-4"
                  key={template.id}
                >
                  <div className="grid gap-1">
                    <h3 className="text-xl font-semibold leading-snug">{template.title}</h3>
                    <p className="text-base capitalize text-[var(--muted)]">
                      {template.schedule_type.replace("_", "-")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="inline-flex min-h-10 items-center rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-base font-semibold"
                      href={`/parent/chores/${template.id}/edit`}
                    >
                      Edit
                    </Link>
                    <form action={deactivateTemplateAction}>
                      <input name="templateId" type="hidden" value={template.id} />
                      <input name="redirectTo" type="hidden" value="chores" />
                      <button className="min-h-10 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-base font-semibold text-[var(--danger)]">
                        Deactivate
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg text-[var(--muted)]">
              No chore templates yet.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
