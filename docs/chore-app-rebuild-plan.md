# Family Responsibility App Rebuild Plan (PWA-first, iOS-focused)

## 1) Product framing

**Mission**

Help families build responsibility, independence, and healthy habits through simple systems for chores, routines, goals, and money.

**Elevator pitch**

[App Name] is a mobile-first family organization app that helps parents and kids manage chores, routines, goals, and money in one simple system. Parents can assign responsibilities and track progress, while kids can manage their own tasks, goals, earnings, and spending. Designed to feel calm, practical, and clear, the app helps families build consistency and independence without turning everyday life into a game.

**Product position**

- The product is a family responsibility and independence app, not only a chore-and-allowance tracker.
- Parent-assigned chores are one responsibility type inside a broader system for routines, goals, and money.
- Money features are optional and configurable. Some households may use responsibilities and routines without allowance, earnings, pay periods, or payout workflows.
- The app should preserve clarity, fairness, consistency, independence, and low-friction family routines.
- The UX should stay calm, practical, and non-gamified. Avoid reward-store, badge, level, points, or streak-heavy framing unless a future phase explicitly adds restrained motivation features.

**Primary users**
- Kids (13-14 now, but design should scale for younger siblings later).
- Parents/guardians who manage responsibilities, routines, approvals, and optional money workflows.

**Core constraints**
- Progressive Web App optimized for iOS Safari + Home Screen install.
- Mobile-first experience, with parent/admin workflows that also work well on desktop.
- Multi-household support for split-custody situations.
- Money should only be attached when the household and responsibility value model require it. Unpaid responsibilities must not create ledger activity.
- Chore approval belongs to the household where the chore was created; payout responsibility belongs to the child's primary household when money features are enabled.
- Split-household and co-parenting support remains a core differentiator.
- Post-MVP should support configurable split-household payout responsibility when money is enabled: either one primary payout household pays all approved earnings, or each household pays for approved chores earned in that household.

## 2) MVP scope (refined from requested feature set)

### Identity, access, and households
- Parent and child roles with secure login.
- A user can belong to multiple households.
- A child can belong to multiple households (e.g., Dad household + Mom household).
- Household settings include whether money features are enabled.
- Households can run in responsibilities/routines-only mode with no allowance, earnings, pay periods, ledger, or payout workflow required.
- Each household with money enabled has one primary payout parent responsible for paying approved earnings for children assigned to that household as their primary household.
- Each child has one primary household for payout responsibility when money features are enabled.
- Parents are scoped to their household(s) and only receive approval requests for those households.
- Parents create households and invite other parents.
- Child accounts use email/password login in MVP.
- Auth/account modeling should not assume every child account must always use email/password. Keep the user/profile model flexible enough to add parent-managed username + PIN later without changing chore, ledger, or household ownership data.
- Household admins send invites to additional parents.

### Parent-assigned responsibility definitions
- Parent-assigned responsibilities use chore/routine templates in MVP. Keep the term "chore" for the implementation model, but product copy should prefer "responsibility" or "routine" where money is not central.
- Chore/routine template fields:
  - title, description, household
  - schedule type: daily / weekly / interval / one-off
  - due-time window (optional)
  - value model: fixed dollar value, allowance-included, or unpaid
  - assignment mode: selected children / all eligible children / up-for-grabs
  - completion evidence requirements:
    - photo required toggle
    - parent approval required toggle
- Supported value models:
  - fixed paid responsibility: approved completion can create money ledger activity when household money features are enabled
  - allowance-included responsibility: counts toward expectations but does not create extra ledger credit
  - unpaid responsibility/routine: never creates money ledger activity
- MVP supports chores/routines-only households and money-enabled households. Money must be optional at both household and chore/template level.
- Points, reward stores, badges, levels, and non-money incentive balances are explicitly out of MVP and should not shape the initial data model.

### Chore instances and occurrence identity
- Recurring and one-off chore templates generate concrete chore instances that represent one due occurrence for one assignee or one up-for-grabs slot.
- Child completion, parent approval, rejection, expiration, and any applicable ledger credit attach to a chore instance, not directly to a chore template.
- A chore template can target one selected child, multiple selected children, all eligible children in the household, or one up-for-grabs slot.
- For selected-child and all-eligible-child assignments, the scheduler creates one child-specific instance per child per occurrence. Each instance has its own status, submission, approval, rejection, expiration, and ledger credit.
- Editing a template's child assignment list affects future generated instances only unless a parent explicitly edits existing instances.
- Each instance records:
  - source template
  - earning household
  - assigned child or up-for-grabs assignment mode
  - occurrence date
  - due window start/end in the household's local timezone
  - value model and amount snapshot
  - photo/approval requirement snapshots
  - current lifecycle status
- Instance generation must be idempotent. A template cannot create duplicate instances for the same assignee/up-for-grabs slot, occurrence date, and due window.
- Editing a chore template affects future generated instances only. Existing instances keep their value, evidence requirements, assignment, and due-window snapshots unless a parent explicitly edits that instance.
- An up-for-grabs template creates one claimable instance per occurrence, not one instance per child.
- Up-for-grabs instances start without an assigned child. When a child claims one, the claim atomically sets and locks the instance's assigned child.
- A claimed up-for-grabs instance behaves like that child's normal assigned chore: submission, approval, rejection, expiration, and ledger credit all attach to the claimed instance.
- Other children cannot claim or submit a claimed up-for-grabs instance.
- Claimed up-for-grabs chores stay assigned to the claiming child until completed, rejected/reopened by a parent, manually released by a parent, or expired.
- Missed chores expire from the instance's due window, giving the app a stable record of what was missed.
- Ledger credits are created only for eligible fixed-value instances in money-enabled households. Approved unpaid and allowance-included instances do not create ledger activity.
- Ledger credits use the approved instance snapshot so historical earnings do not change when a template is edited later.

### Chore lifecycle
- States:
  - `available` (for up-for-grabs)
  - `assigned`
  - `submitted`
  - `approved`
  - `rejected`
  - `expired` (if missed window)
- Up-for-grabs chores can be claimed once; claim locks assignment.
- If approval required and the instance is money-producing: funds are pending until approved.
- If no approval required and the instance is money-producing: auto-credit on submission completion.
- If the instance is unpaid or allowance-included, completion and approval affect responsibility status only and do not create ledger rows.
- Rejected chores can be resubmitted on the same instance with parent feedback preserved.
- Missed chores auto-expire after the due window. Expired chores do not create credit unless a parent later reopens or manually adjusts them.
- Parents can reopen expired chores.
- If a rejected chore is past its original due window, the child must request that a parent reopen it before resubmitting.

### Views
- **Child home**: sections for parent-assigned responsibilities such as Today, This Week, and Whenever.
- **Child money**: shown only when money is enabled; current pay period totals, pending approvals, approved amount, and payout owner.
- **Parent dashboard**: quick per-child status for today + pending approvals queue.
- **Parent payout queue**: shown only when money is enabled; children/pay periods this parent is responsible for paying.
- **Parent history**: completed/approved/rejected filterable list.

### Pay periods and ledger
- Pay periods, ledger, earnings, adjustments, and payout closeout are optional MVP modules enabled by household settings.
- Chores/routines-only households should not be forced through pay-cycle setup or payout closeout.
- Parent-defined recurring pay cycles using family-friendly presets:
  - weekly: choose weekday.
  - biweekly: choose weekday plus anchor date so every-other-week behavior is deterministic.
  - monthly date: choose day of month; if the day does not exist in a shorter month, use the last day of that month.
  - monthly weekday: choose ordinal weekday, such as first Monday, third Wednesday, or last Friday.
- Pay periods close in the payout household's local timezone.
- Approved chore earnings belong to the pay period containing the approval date, because money is not earned until approval.
- Changing a pay cycle affects future open periods only unless a later administrative recalculation flow is added.
- Immutable transaction ledger:
  - pending credit
  - approved credit
  - manual adjustment
  - payout
- Ledger amounts are dollar/cents based. No points or non-money reward balances in MVP.
- Ledger transactions record both the earning household and payout household.
- Approved earnings from any household flow into the child's pay period under the child's primary household payout responsibility.
- MVP tracks chore-earned money. Baseline allowance is not automatically generated as a recurring ledger entry in MVP; if needed, it can be represented with a manual adjustment until automatic baseline allowance is added later.
- `allowance-included` chores count for completion expectations but do not create extra ledger credit.
- Unpaid chores/routines count for completion expectations but do not create ledger credit.
- Payout flow marks period as paid without deleting historical transactions.
- Changing a child's primary household or payout parent affects future credits only.

### Child-owned personal organization (Phase 2 planning, not MVP)
- Child-created personal todos and goals are Phase 2 features. They should be planned now but not added to MVP implementation scope.
- These items are separate from parent-assigned chores/routines. They are independence-building tools, not parent-assigned obligations.
- Initial fields should be simple:
  - title
  - description
  - optional due date or reminder
  - status
  - optional goal type
- Parent visibility, notifications, and control settings should be configurable later. MVP can start without these models, but the architecture should leave a clear boundary between parent-assigned responsibilities and child-owned tasks/goals.

### Financial habit support (Phase 2 planning, not MVP)
- Phase 2 should add child budgeting, spending tracking, savings goals, basic money categories, and optional manual spending entry.
- Future money features should eventually connect allowance/earnings to budget and savings tracking, but MVP should not become a banking app.
- These features should remain lightweight, manual-first, and family-oriented unless a later product decision adds financial account integrations.

### Notifications (MVP)
- Push notification when:
  - new up-for-grabs chore is created
  - child submits chore requiring approval
  - chore is approved/rejected
- Approval notifications fan out to all household parents for the earning household.

## 3) Finalized MVP policy decisions

1. **Custody/week context**
   - MVP includes household availability windows per child so chores only instantiate during that household's custody window.
   - Availability supports a base repeating custody pattern plus date-specific overrides for summer, holidays, travel, and other non-standard weeks.

2. **Late/missed policy**
   - Default MVP behavior is auto-expire with zero credit after the due window.
   - Parents can reopen expired chores directly.

3. **Dispute/resubmission flow**
   - Rejected chores support feedback + resubmission on the same chore instance.
   - If the original due window has passed, the child must request a parent reopen before resubmitting.

4. **Abuse prevention and fairness**
   - Up-for-grabs claims are protected by one-claim-per-instance locking.
   - Active claimed chore caps are post-MVP unless testing shows they are needed immediately.

5. **Money policy clarity**
   - Money is optional by household and by responsibility. Families can use the app for unpaid responsibilities and routines only.
   - Distinguish baseline allowance vs earned chores in reporting.
   - Changing a child's primary household or payout parent affects future credits only.
   - MVP tracks chore-earned money only. Automatic baseline allowance ledger entries are post-MVP.
   - Unpaid and allowance-included responsibilities must not create ledger rows.
   - Post-MVP should let parents choose the payout responsibility model for custody situations:
     - primary payout household pays all approved earnings
     - each earning household pays for chores completed/approved in that household

6. **Photo privacy and retention**
   - Completion photos are retained through payout closeout for the relevant pay period.
   - After payout closeout, photo files are deleted while the historical submission/approval record remains.
   - Parents can delete submitted photos at any point for mistaken uploads, privacy concerns, inappropriate photos, or simple cleanup.
   - Deleting a photo removes the stored image file but does not delete the historical submission, approval, rejection, or payout record.

7. **Onboarding details**
   - Children use email/password login in MVP.
   - The auth model should allow parent-managed username + PIN to be added later without changing domain ownership records.
   - Household admins invite second-household parents and other parent/admin users.

## 4) Competitive patterns observed (research synthesis)

Common patterns across current chore, routine, and allowance apps:
- Parent approvals before money is credited.
- Optional photo proof for completion.
- Recurrence flexibility (daily, weekly, custom intervals).
- Child earning ledgers with pending vs approved balances.
- Household/family sharing and role-based controls.

Also observed in market messaging:
- Setup friction and approval fatigue are frequent pain points.
- Families want at-a-glance daily execution, not just admin power.
- Recurrence edge cases (e.g., every X days after completion) matter.

## 5) Proposed MVP architecture (fresh start)

### Frontend
- Next.js App Router PWA.
- Installable web app with service worker + manifest.
- Separate role-based surfaces:
  - `/kid/*`
  - `/parent/*`

### Backend
- Postgres + row-level security.
- Server actions/API routes for chore lifecycle transitions.
- Object storage for chore completion photos.

### Domain model (high-level)
- `users`
- `households`
- `household_settings` or household-level settings fields, including `money_features_enabled`
- `household_memberships` (role parent/child)
- `child_profiles` (including primary household)
- `child_household_availability_windows`
- `child_household_availability_overrides`
- `chore_templates`
- `chore_instances`
- `chore_claims` (for up-for-grabs)
- `chore_submissions`
- `approval_events`
- `pay_cycle_settings`
- `pay_periods`
- `ledger_transactions`
- `payout_events`
- `notification_events`

Phase 2 domain placeholders:
- `child_personal_tasks`
- `child_goals`
- `child_budgets`
- `child_spending_entries`
- `child_savings_goals`

### Critical invariants
- Only household parents can approve that household's submissions.
- Ledger entries are append-only.
- Approval-required chores cannot be credited before approval.
- Claimed up-for-grabs chores cannot be claimed again.
- A chore template assigned to multiple children generates separate child-specific instances so each child has independent completion, approval, and payout behavior.
- Chore instances are uniquely identified by template, assignee/up-for-grabs slot, occurrence date, and due window.
- Chore submissions, approvals, expirations, and ledger credits attach to chore instances.
- Existing chore instances retain their snapshotted value and evidence requirements after template edits.
- Household settings determine whether money workflows are enabled.
- Chore templates and chore instances can be unpaid and not ledger-producing.
- Ledger rows are created only for eligible money-producing instances.
- Each child has exactly one primary household at a time.
- Each money-enabled household has exactly one primary payout parent at a time.
- Historical ledger records retain their original earning household and payout owner.
- Pay cycle presets, not arbitrary RRULEs, drive MVP pay period generation.
- Approval date determines the pay period for approved chore earnings.
- Pending credits are informational only. They are not payable and cannot be included in payout closeout until approved.
- No points, rewards, or non-money incentive balances in MVP.

## 6) Primary household payout model

MVP uses the primary household model only for households with money features enabled:

- A child's primary household determines who pays that child's approved earnings, regardless of where the chore was completed.
- A household's primary payout parent is responsible for closing pay periods for children whose primary household is that household.
- Example: Will completes chores at Mom's household. Mom's household parents approve those chores. The approved credits still appear in Will's pay-period balance payable by Dad if Dad's household is Will's primary household.
- Ledger transactions should include:
  - `earning_household_id`: where the chore was created/completed/approved
  - `payout_household_id`: the child's primary household at credit time
  - `payout_parent_id`: the primary payout parent responsible at credit time
- Approval permissions remain earning-household scoped.
- Payout closeout permissions are payout-household scoped.
- Changing a primary household or payout parent affects future ledger entries only in MVP.

Post-MVP Phase 2 payout model option:
- Add a child/household payout policy setting so custody families can choose whether payout follows the child's primary household or the earning household.
- Under earning-household payout mode, each household is responsible for paying chores completed and approved in that household.
- Historical ledger entries must continue to snapshot `earning_household_id`, `payout_household_id`, and `payout_parent_id` at credit time so changing the policy affects future credits only.

## 7) Build roadmap (phase-gated)

The numbered MVP implementation phases below are delivery slices for the first release. The broader product Phase 2 follows the MVP and should contain child-owned organization and financial habit features.

### MVP Phase 0 - Product spec lock (no coding)
- Finalize business rules for all ambiguous cases.
- Agree on state machine and ledger event types.
- Write acceptance criteria per user story.

### MVP Phase 1 - Foundation
- Auth + household membership.
- Child profiles, primary household assignment, household money settings, and payout parent settings for money-enabled households.
- Chore template CRUD.
- Instance generation engine for daily/weekly/interval.

### MVP Phase 2 - Kid execution
- Child home views (Today/Week/Whenever).
- Submit chore with optional photo.
- Up-for-grabs claim flow.

### MVP Phase 3 - Parent operations
- Approval queue.
- Approve/reject + feedback.
- Parent quick-glance dashboard.

### MVP Phase 4 - Optional money
- Pay cycle settings, generated pay periods, ledger, payout ownership, payout closeout.
- Child earnings view with pending/approved separation.

### MVP Phase 5 - Notifications + polish
- Web push + in-app inbox fallback.
- Reliability tuning, retries, and analytics.

### Product Phase 2 - Independence and financial habits
- Child-created todos.
- Child-created goals.
- Basic budgeting.
- Spending tracking with optional manual spending entry.
- Savings goals.
- Basic money categories.
- Eventual connection between allowance/earnings and budget/savings tracking.
- Configurable custody payout policy, including earning-household payout responsibility.

## 8) Suggested additions to your feature set (high-value)

- **Resubmission after rejection** (with parent comments).
- **Chore difficulty tags** to help fair payouts.
- **Consistency insights** (restrained, non-gamified, and post-MVP only).
- **Quiet hours + reminder controls** per household.
- **Needs supplies checklist** for chores needing materials.
- **Parent weekly digest** summary by child.

## 9) Research references used

- Homey manual/FAQ and feature documentation (recurrence, photo completion, confirmation requirements).
- GoHenry earning/chores product pages (allowance + paid chores behavior).
- App Store review patterns indicating parent pain points around approval/photo workflows.
- Recent chore-app comparison/editorial trend pieces highlighting setup friction and approval fatigue.

## 10) Implementation decisions

### Tech stack
- Build the app with Next.js App Router, TypeScript, and Tailwind.
- Use Postgres with row-level security for core data isolation. Supabase is the preferred default unless a later infrastructure decision replaces it with an equivalent Postgres + auth + storage stack.
- Store chore completion photos in object storage, referenced from `chore_submissions`.
- Use Zod schemas at API/server-action boundaries for request validation and typed domain inputs.
- Use server actions/API routes for lifecycle commands such as claim, submit, approve, reject, expire, adjust, and payout closeout.
- Pick one durable job runner before Phase 1 implementation starts: Trigger.dev, Inngest, or a Postgres-backed worker/pg_cron approach. The selected runner must support idempotent scheduled instance generation and retryable notification/photo-processing jobs.

### Architecture constraints
- Business invariants must be enforced in both the database and the service layer. UI checks are helpful but not authoritative.
- Ledger behavior must be append-only and covered by invariant tests.
- Approval permissions and payout permissions are separately scoped: approval follows the earning household, while payout closeout follows the child's primary payout household.
- Chore lifecycle transitions should go through explicit command functions instead of direct table updates from UI code.
- Money-related writes should use database transactions so approval, ledger creation, and pay-period assignment cannot partially succeed.
- Service commands must allow responsibility approval/completion without ledger creation when household money features are disabled or the instance value model is unpaid/allowance-included.
- Parent-assigned responsibility models must remain separate from Phase 2 child-owned personal tasks and goals.

### Offline and notification policy
- MVP offline support includes viewing cached chore lists, queueing chore submissions, and retrying photo uploads.
- Offline approvals, payout closeout, account management, household membership changes, and template edits are online-only in MVP.
- Queued submissions must use client-generated idempotency keys so retries do not create duplicate submissions or credits.
- Photo upload retry should keep the chore submission pending sync until both metadata and object storage upload complete.
- Web push is best-effort. Every push notification event must also create an in-app inbox item so families still see approvals/rejections when push is unavailable or disabled on iOS.

### Testing strategy by phase
- Phase 1 requires unit tests for schedule generation, timezone handling, and idempotent instance creation.
- Phase 2 requires integration tests for claim, submit, photo-required, approval-required, unpaid completion, allowance-included completion, and no-approval auto-credit paths.
- Phase 3 requires permission tests for household-scoped approval, rejection feedback, resubmission, and notification event creation.
- Phase 4 requires optional-money settings, ledger, pay-period, payout ownership, manual adjustment, and closeout invariant tests.
- Phase 5 requires E2E coverage for the core kid submission flow, parent approval flow, and payout closeout flow.
- Definition of done for money and approval work includes RLS tests, service-layer invariant tests, and regression coverage for duplicate submission/duplicate credit prevention.

### Operational decisions
- Store all timestamps in UTC and store household timezone as an IANA timezone string. Period closing and due-window interpretation use the relevant household's local timezone.
- Use database unique constraints plus idempotency keys for recurring instance generation, up-for-grabs claims, submissions, ledger credits, notification events, and payout closeout.
- Keep audit logs for approvals, rejections, adjustments, payout closeout, primary household changes, payout parent changes, and permission-sensitive admin actions.
- Audit logs should retain actor, household context, target entity, before/after summary where appropriate, timestamp, and request id.
- Historical ledger records should never be rewritten by normal product flows. Corrections use compensating manual adjustment transactions.

## 11) Product direction conflicts and open questions

### Conflicts to resolve before implementation
- Existing schema notes and migrations assume payout parent and pay cycle setup are core household setup. The broader product direction requires responsibilities/routines-only households where those settings are optional.
- Existing command notes imply approval always creates an approved-credit ledger row for fixed-value chores. Commands need an explicit no-ledger path for money-disabled households, unpaid responsibilities, and allowance-included responsibilities.
- Existing child home guidance is responsibility-only. Phase 2 requires a separate personal todos/goals area without making those items feel parent-assigned.

### Open questions
- Should money be enabled per household only, or can each child also opt into or out of money features within a money-enabled household?
- Should a fixed-value chore be allowed when household money features are disabled, or should the UI prevent that configuration entirely?
- What parent visibility should child-created todos and goals have by default in Phase 2?
- Should savings goals live under child goals, money, or a separate savings model in the first Phase 2 release?
- Should manual spending entries require parent review, or are they child-owned records by default?

## 12) UI/UX and accessibility decisions

### Design principles
- The app should be clean, minimal, and low-density. It should feel calm and direct rather than dashboard-heavy or gamified.
- The app is mobile-first. Core child and parent workflows must work well on phone-sized screens before desktop layouts are expanded.
- Simple, clear views are a core requirement, especially for child-facing screens.
- Each screen should have one primary job and one obvious next action.
- Avoid decorative clutter, heavy gradients, dense card grids, badges everywhere, or reward-store styling in MVP.
- Use whitespace, readable hierarchy, and plain language instead of visual noise.

### Mobile-first responsive behavior
- Phone layouts are the baseline for all core flows: child home, chore detail, claim, submit, earnings, parent approvals, and payout closeout.
- Mobile views should use single-column layouts, clear section breaks, and stacked actions.
- Avoid desktop-first tables or multi-column controls in workflows that must be usable on mobile.
- Desktop layouts may add space, persistent navigation, filters, and side-by-side review panes, but they should not introduce desktop-only functionality for core tasks.
- Parent/admin areas must function well on desktop for setup, review, history, and optional payout workflows.
- Parent/admin desktop views can use wider layouts for scanning and management, but they should preserve the same information hierarchy and plain-language states as mobile.

### Large text and visual accessibility
- Will's visual impairment makes iOS large text support a non-negotiable product constraint.
- The UI must support iOS Dynamic Type / large text settings from the start.
- Do not use fixed-height cards, buttons, list rows, nav bars, or modal layouts that clip or overlap when text scales.
- Text should wrap naturally. Important labels, chore names, feedback, statuses, and action text should not be truncated by default.
- Use system fonts or similarly legible fonts with clear weight differences.
- Maintain strong contrast for text, icons, controls, dividers, and status indicators.
- Do not rely on color alone to communicate state. Pair color with plain text and, where useful, a simple icon.
- Use real text for all meaningful content. Do not bake text into images.

### Screen density and progressive disclosure
- Child views should show only the information needed to decide what to do next.
- Prefer short, focused lists and detail screens over showing every field on the main screen.
- Chore rows/cards should show essential information only:
  - chore name
  - due timing or section
  - value/status when relevant
  - required next action
- Secondary information such as full description, photo requirement details, approval history, rejection feedback, and household metadata should live in focused detail views.
- Avoid placing too many competing panels, summaries, counters, or filters on one child-facing screen.
- Parent views can be denser than child views, but approval, payout, history, and settings should remain separate workflows.

### Navigation and interaction
- Use predictable top-level navigation with clear labels.
- Avoid hidden gesture-only interactions for core actions.
- Keep the main child tasks reachable in one or two taps.
- Use large tap targets for all primary actions.
- Primary actions should use direct verbs such as `Claim`, `Submit`, `Approve`, `Reject`, and `Pay`.
- Money-related, destructive, or permission-sensitive actions should require clear confirmation.
- Loading, offline, syncing, submitted, waiting-for-approval, rejected, approved, and paid states should be obvious in plain language.

### Child experience
- The child home screen should answer "What do I need to do now?" immediately.
- Use sections such as Today, This Week, and Whenever for parent-assigned responsibilities, but keep each section visually simple.
- Phase 2 child home should clearly separate parent-assigned responsibilities from personal todos/goals and from money/budget/savings areas where enabled.
- Child-created goals should feel self-directed, not like another parental control surface.
- The current status and next action should be visually dominant.
- Avoid requiring kids to understand pay-period mechanics to understand what they earned or what is waiting for approval.
- Use plain labels such as "Waiting for approval" instead of relying on internal terms like "pending."

### Parent experience
- Parent UX should reduce approval fatigue.
- The approval queue should make the chore, child, submitted evidence, and approve/reject actions easy to scan.
- Parent dashboards should prioritize today's status and pending approvals, not full reporting.
- Parent/admin setup and management flows should be comfortable on desktop, including chore template editing, household settings, optional pay cycle settings, history review, and optional payout closeout.
- Payout closeout should clearly show which child, which pay period, who is responsible for paying, and what amount is being marked paid.

### Errors, empty states, and offline states
- Error messages should explain what happened and what the user can do next.
- Empty states should be functional and brief.
- Offline and sync states should be calm and explicit, for example:
  - "Saved. Will upload when online."
  - "Photo still uploading."
  - "Submission sent."
- If an action cannot be completed offline, the UI should say so before the user invests effort.

### UI definition of done
- Every UI feature must be checked at large and largest iOS text sizes before it is considered complete.
- Every core workflow must be checked on mobile viewport sizes first, then desktop where applicable.
- Parent/admin workflows must be checked on desktop as well as mobile.
- Layouts must not clip text, overlap controls, hide primary actions, or require horizontal scrolling at large text sizes.
- VoiceOver labels and focus order should be tested for core flows, even if VoiceOver is not the primary accessibility need.
- Tap target size, contrast, keyboard/focus behavior, and reduced-motion behavior should be included in UI acceptance criteria.
