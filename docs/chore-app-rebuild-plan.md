# Chore App Rebuild Plan (PWA-first, iOS-focused)

## 1) Product framing

**Primary users**
- Kids (13-14 now, but design should scale for younger siblings later).
- Parents/guardians who manage chores, approvals, and payouts.

**Core constraints**
- Progressive Web App optimized for iOS Safari + Home Screen install.
- Multi-household support for split-custody situations.
- Money should only be earned when business rules allow (approval/photo gates).
- Chore approval belongs to the household where the chore was created; payout responsibility belongs to the child's primary household.

## 2) MVP scope (refined from requested feature set)

### Identity, access, and households
- Parent and child roles with secure login.
- A user can belong to multiple households.
- A child can belong to multiple households (e.g., Dad household + Mom household).
- Each household has one primary payout parent responsible for paying allowances for children assigned to that household as their primary household.
- Each child has one primary household for payout responsibility.
- Parents are scoped to their household(s) and only receive approval requests for those households.

### Chore definitions
- Chore template fields:
  - title, description, household
  - schedule type: daily / weekly / interval / one-off
  - due-time window (optional)
  - value model: fixed dollar value, allowance-included, or unpaid
  - assignment mode: specific child / all children / up-for-grabs
  - completion evidence requirements:
    - photo required toggle
    - parent approval required toggle
- MVP is allowance-money focused only. Points, reward stores, badges, and non-money incentives are explicitly post-MVP and should not shape the initial data model.

### Chore instances and occurrence identity
- Recurring and one-off chore templates generate concrete chore instances that represent one due occurrence for one assignee or one up-for-grabs slot.
- Child completion, parent approval, rejection, expiration, and ledger credit attach to a chore instance, not directly to a chore template.
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
- Missed chores expire from the instance's due window, giving the app a stable record of what was missed.
- Ledger credits are created from the approved instance snapshot so historical earnings do not change when a template is edited later.

### Chore lifecycle
- States:
  - `available` (for up-for-grabs)
  - `assigned`
  - `submitted`
  - `approved`
  - `rejected`
  - `expired` (if missed window)
- Up-for-grabs chores can be claimed once; claim locks assignment.
- If approval required: funds are pending until approved.
- If no approval required: auto-credit on submission completion.

### Views
- **Child home**: sections for Today, This Week, and Whenever.
- **Child earnings**: current pay period totals, pending approvals, approved amount, and payout owner.
- **Parent dashboard**: quick per-child status for today + pending approvals queue.
- **Parent payout queue**: children/pay periods this parent is responsible for paying.
- **Parent history**: completed/approved/rejected filterable list.

### Pay periods and ledger
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
- Payout flow marks period as paid without deleting historical transactions.

### Notifications (MVP)
- Push notification when:
  - new up-for-grabs chore is created
  - child submits chore requiring approval
  - chore is approved/rejected
- Approval notifications fan out to all household parents for the earning household.

## 3) Key holes to close before implementation

1. **Custody/week context**
   - Add a household availability calendar per child so chores only instantiate during that household's custody window.

2. **Late/missed policy**
   - Define outcomes for missed daily/weekly chores (carry-over, auto-expire, partial credit, zero credit).

3. **Dispute/resubmission flow**
   - Rejected chore should support feedback + resubmission.

4. **Abuse prevention and fairness**
   - For up-for-grabs, optionally cap active claimed chores per child.

5. **Allowance policy clarity**
   - Distinguish baseline allowance vs earned chores in reporting.
   - Decide whether changing a child's primary household affects future credits only or can reassign an open pay period before payout.
   - Decide whether baseline allowance itself creates an automatic ledger entry each pay period or whether MVP only tracks chore-earned money.

6. **Offline behavior (PWA reality on iOS)**
   - Define exact offline actions supported (view cached chores, queue submissions, image upload retry).

7. **Notification fallback**
   - Add in-app inbox for households where web push is not enabled.

8. **Auditability**
   - Keep event log for approvals/rejections/adjustments with actor + timestamp.

## 4) Competitive patterns observed (research synthesis)

Common patterns across current chore/allowance apps:
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
- `household_memberships` (role parent/child)
- `child_profiles` (including primary household)
- `child_household_availability_windows`
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

### Critical invariants
- Only household parents can approve that household's submissions.
- Ledger entries are append-only.
- Approval-required chores cannot be credited before approval.
- Claimed up-for-grabs chores cannot be claimed again.
- Chore instances are uniquely identified by template, assignee/up-for-grabs slot, occurrence date, and due window.
- Chore submissions, approvals, expirations, and ledger credits attach to chore instances.
- Existing chore instances retain their snapshotted value and evidence requirements after template edits.
- Each child has exactly one primary household at a time.
- Each household has exactly one primary payout parent at a time.
- Historical ledger records retain their original earning household and payout owner.
- Pay cycle presets, not arbitrary RRULEs, drive MVP pay period generation.
- Approval date determines the pay period for approved chore earnings.
- No points, rewards, or non-money incentive balances in MVP.

## 6) Primary household payout model

- A child's primary household determines who pays that child's allowance, regardless of where the chore was completed.
- A household's primary payout parent is responsible for closing pay periods for children whose primary household is that household.
- Example: Will completes chores at Mom's household. Mom's household parents approve those chores. The approved credits still appear in Will's pay-period balance payable by Dad if Dad's household is Will's primary household.
- Ledger transactions should include:
  - `earning_household_id`: where the chore was created/completed/approved
  - `payout_household_id`: the child's primary household at credit time
  - `payout_parent_id`: the primary payout parent responsible at credit time
- Approval permissions remain earning-household scoped.
- Payout closeout permissions are payout-household scoped.
- Changing a primary household or payout parent should affect future ledger entries only unless a specific administrative reassignment flow is later added.

## 7) Build roadmap (phase-gated)

### Phase 0 - Product spec lock (no coding)
- Finalize business rules for all ambiguous cases.
- Agree on state machine and ledger event types.
- Write acceptance criteria per user story.

### Phase 1 - Foundation
- Auth + household membership.
- Child profiles, primary household assignment, and household payout parent settings.
- Chore template CRUD.
- Instance generation engine for daily/weekly/interval.

### Phase 2 - Kid execution
- Child home views (Today/Week/Whenever).
- Submit chore with optional photo.
- Up-for-grabs claim flow.

### Phase 3 - Parent operations
- Approval queue.
- Approve/reject + feedback.
- Parent quick-glance dashboard.

### Phase 4 - Money
- Pay cycle settings, generated pay periods, ledger, payout ownership, payout closeout.
- Child earnings view with pending/approved separation.

### Phase 5 - Notifications + polish
- Web push + in-app inbox fallback.
- Reliability tuning, retries, and analytics.

## 8) Suggested additions to your feature set (high-value)

- **Resubmission after rejection** (with parent comments).
- **Chore difficulty tags** to help fair payouts.
- **Streak + consistency insights** (motivation without over-gamifying).
- **Quiet hours + reminder controls** per household.
- **Needs supplies checklist** for chores needing materials.
- **Parent weekly digest** summary by child.

## 9) Research references used

- Homey manual/FAQ and feature documentation (recurrence, photo completion, confirmation requirements).
- GoHenry earning/chores product pages (allowance + paid chores behavior).
- App Store review patterns indicating parent pain points around approval/photo workflows.
- Recent chore-app comparison/editorial trend pieces highlighting setup friction and approval fatigue.
