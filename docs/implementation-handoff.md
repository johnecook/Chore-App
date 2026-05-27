# Family Responsibility App Implementation Handoff

Use this as the starting brief for implementation. The full product plan is in `docs/chore-app-rebuild-plan.md`; the testing plan is in `docs/testing-strategy.md`.

## Current goal

Build a mobile-first family responsibility and independence PWA for kids and parents, optimized for iOS Safari/Home Screen install, with parent/admin workflows that also function well on desktop.

The app must support:
- multi-household families and split-custody situations
- parent-assigned chores/routines with optional photo evidence
- parent approval/rejection/reopen workflows
- households that use responsibilities/routines without money
- optional chore-earned money tracking
- optional payout ownership based on the child's primary household
- strong accessibility, especially iOS large text support for Will's visual impairment

Phase 2 should add child-created todos, child-created goals, basic budgeting, spending tracking, and savings goals. Do not expand the MVP into a broad productivity or banking app.

## Implementation posture

- Start local. Vercel and Supabase account access are not required to begin.
- Supabase is the preferred default for Postgres, auth, RLS, and storage unless replaced by an equivalent stack.
- Vercel can be connected later when there is a deployable slice.
- Keep implementation conservative and testable. Business rules belong in database constraints/RLS and service-layer command functions, not only in UI code.
- Treat money as optional by household and by responsibility value model.

## Stack decisions

- Next.js App Router
- TypeScript
- Tailwind
- Postgres with RLS
- Object storage for chore completion photos
- Zod at server-action/API boundaries
- Durable job runner to be selected before scheduled/background work: Trigger.dev, Inngest, or Postgres-backed worker/pg_cron

## MVP domain model

Start from these high-level entities:
- `users`
- `households`
- household-level settings, including whether money features are enabled
- `household_memberships`
- `child_profiles`
- `child_household_availability_windows`
- `child_household_availability_overrides`
- `chore_templates`
- `chore_instances`
- `chore_claims`
- `chore_submissions`
- `approval_events`
- `pay_cycle_settings`
- `pay_periods`
- `ledger_transactions`
- `payout_events`
- `notification_events`

Phase 2 placeholders, not MVP tables unless explicitly pulled forward:
- `child_personal_tasks`
- `child_goals`
- `child_budgets`
- `child_spending_entries`
- `child_savings_goals`

## Critical business rules

- Parents create households and household admins invite additional parents.
- Parent accounts belong to one household at a time. If a parent accepts an invite to a different household, disconnect that parent from the previous parent/admin household membership.
- Child accounts can still belong to multiple households for split-household support.
- Parent household management should be one combined view for household settings, parent membership, child membership, invites, and child availability entry points. Do not split parent/child household membership management across separate top-level screens.
- Child accounts use email/password in MVP.
- Auth/profile modeling must allow parent-managed username + PIN later without changing chore, ledger, or household ownership data.
- A child can belong to multiple households but has exactly one primary payout household at a time when money features are enabled.
- A household has exactly one primary payout parent at a time when money features are enabled.
- Approval permissions are earning-household scoped.
- Payout closeout permissions are payout-household scoped when money features are enabled.
- Changing a child's primary household or payout parent affects future credits only.
- Post-MVP should add a configurable custody payout policy so families can choose primary-household payout responsibility or earning-household payout responsibility.
- Chore templates generate concrete chore instances.
- Template edits affect future generated instances only.
- Existing instances retain value, evidence requirement, assignment, and due-window snapshots.
- Multi-child template assignments generate separate child-specific instances.
- Up-for-grabs templates create one claimable instance per occurrence.
- Up-for-grabs instances can be claimed once.
- Approval-required chores cannot create payable credit before approval.
- Pending credits are informational only and cannot be paid out.
- Approved earnings belong to the pay period containing the approval date.
- Ledger transactions are append-only.
- Corrections use compensating manual adjustment transactions.
- MVP tracks chore-earned money only when money is enabled; automatic baseline allowance is post-MVP.
- `allowance-included` chores count for expectations but do not create extra credit.
- Unpaid chores/routines count for expectations but do not create ledger activity.
- Responsibilities/routines-only households should not require pay-cycle setup, ledger rows, or payout closeout.
- Missed chores auto-expire after the due window with zero credit.
- Parents can reopen expired chores.
- Rejected chores preserve feedback and can be resubmitted on the same instance.
- If a rejected chore is past due, the child must request parent reopen before resubmitting.
- Completion photos are retained through payout closeout, then image files are deleted while history remains.
- Parents can delete submitted photos at any point without deleting submission/approval/rejection/payout history.

## Custody and scheduling

MVP custody availability must support:
- a base repeating custody pattern
- date-specific overrides for summer, holidays, travel, and other non-standard weeks

Instance generation must be idempotent by template, assignee/up-for-grabs slot, occurrence date, and due window.

All timestamps should be stored in UTC. Household timezone should be stored as an IANA timezone string. Due windows and pay period closing use the relevant household's local timezone.

## UI/UX constraints

- Mobile-first is mandatory.
- Parent/admin flows must also work well on desktop.
- Keep the design clean, minimal, and low-density.
- Each screen should have one primary job and one obvious next action.
- Child views should avoid dense dashboards and show only what is needed to answer: "What do I need to do now?"
- Child home should separate parent-assigned responsibilities from Phase 2 personal todos/goals and from money/budget/savings areas where enabled.
- Child-created goals should feel self-directed rather than parent-controlled.
- Support iOS Dynamic Type / large text from the start.
- Avoid fixed-height controls that clip or overlap when text scales.
- Use strong contrast and never rely on color alone for state.
- Use plain language such as "Waiting for approval" instead of internal terms like "pending."
- UI features are not done until checked on mobile, large text, and applicable parent/admin desktop layouts.

## Testing expectations

Follow `docs/testing-strategy.md`.

Early implementation should prioritize tests for:
- schedule generation
- timezone and due-window handling
- custody base pattern plus overrides
- instance generation idempotency
- household membership and role permissions
- primary household and payout parent constraints
- chore template CRUD permissions
- unpaid and allowance-included completion paths that do not create ledger activity
- money-disabled household flows that do not require pay cycles or payout closeout

Money, permission, RLS, photo deletion, payout, and scheduling bugs must add regression tests.

## Environment variables

Use `.env.example` as the template for local and hosted environments.

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL. Browser-safe.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key. Browser-safe but environment-specific.
- `SUPABASE_SERVICE_ROLE_KEY`: Server-only key for privileged jobs or admin operations. Never import this into client components.

Local Supabase values come from `supabase status`. Hosted values should be copied from the Supabase project settings when the hosted project is created or linked.

## Suggested first implementation slice

1. Scaffold the Next.js + TypeScript + Tailwind app.
2. Add project structure for `app`, domain/service modules, validation schemas, and tests.
3. Define core TypeScript enums/types for roles, chore lifecycle states, assignment modes, value models, household money settings, pay cycles, and ledger transaction types.
4. Implement pure domain tests first for:
   - chore lifecycle transition guards
   - schedule generation
   - custody availability with overrides
   - pay period calculation
5. Add initial database schema/migration draft.
6. Add RLS/permission test plan or harness once the database approach is wired.
7. Build the first UI shell only after the core domain vocabulary is stable.

## Do not start with

- A dense dashboard UI.
- Gamification, points, badges, stores, or reward catalogs.
- Phase 2 child-owned todos, goals, budgets, spending, or savings implementation before the MVP responsibility/money boundary is stable.
- Production deployment setup.
- Vercel integration.
- Real Supabase project setup unless auth/RLS/storage implementation is ready.
- Desktop-first admin tables for workflows that must also work on mobile.

## Current docs to keep updated

- `docs/chore-app-rebuild-plan.md`: product, architecture, and UX plan.
- `docs/testing-strategy.md`: testing layers, invariant checklist, phase gates, and regression log.
- `docs/implementation-handoff.md`: current implementation entry point.
