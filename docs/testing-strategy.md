# Family Responsibility App Testing Strategy

This document is the living testing plan for the family responsibility app. Update it as implementation details, edge cases, and regressions are discovered.

## 1) Testing principles

- Test domain invariants before UI convenience.
- Treat permissions, optional money movement, scheduling, and photo retention as high-risk areas.
- Test responsibilities/routines-only households as first-class MVP flows, not edge cases.
- Keep business rules covered at the lowest practical layer, then add integration and E2E tests for the full workflow.
- UI checks must include mobile-first layouts, large iOS text sizes, and parent/admin desktop usability.
- Every bug fix in scheduling, approval, ledger, payout, RLS, or photo deletion should add a regression test.
- Every bug fix involving unpaid responsibilities, allowance-included responsibilities, or money-disabled households should add a regression test.
- Tests should use realistic multi-household examples, including Will completing chores in one household while payout responsibility belongs to another.

## 2) Test layers

### Unit tests
- Pure schedule generation.
- Pay period calculation.
- Timezone and due-window interpretation.
- Chore lifecycle transition guards.
- Ledger amount calculations.
- Permission helper functions where logic exists outside RLS.
- Formatting and view-model helpers for large-text-friendly UI.

### Database tests
- Row-level security policies.
- Foreign keys and ownership constraints.
- Unique constraints for idempotency.
- Auth profile bootstrap from sign-up metadata.
- Parent household onboarding command.
- Household money feature settings.
- Child invitation creation and acceptance.
- Parent-managed child availability base pattern and overrides.
- Append-only ledger behavior.
- Non-ledger completion for unpaid, allowance-included, and money-disabled responsibility flows.
- Claim locking for up-for-grabs instances.
- Photo metadata retention after object deletion.
- Audit log creation for sensitive actions.
- Command RPC smoke tests for claim, submit, approve, reject, reopen, and payout closeout.

### Integration tests
- Server actions/API route command flows.
- Database transaction behavior for money-related writes.
- Authenticated parent/child access across households.
- Job-runner behavior for instance generation, expiration, photo cleanup, and notifications.
- Object storage metadata and deletion flows.

### End-to-end tests
- Core child chore flow.
- Core parent approval flow.
- Rejection, reopen, and resubmission flow.
- Parent payout closeout flow where money is enabled.
- Responsibilities/routines-only flow with no pay cycle, ledger, or payout closeout.
- Parent/admin setup on desktop.
- Mobile child experience with large text.

### Accessibility and responsive checks
- iOS-sized mobile viewports first.
- Parent/admin desktop viewports for setup, review, history, and optional payout flows.
- Large and largest iOS text settings simulated where possible.
- No clipped text, overlapping controls, hidden primary actions, or horizontal scrolling in core flows.
- VoiceOver labels and focus order for primary screens.
- Color contrast and non-color-only status communication.

## 3) Critical invariant checklist

These should be covered by automated tests where possible.

- Only household parents can approve submissions for that earning household.
- Payout closeout permissions are scoped to the child's payout household when money is enabled.
- A child has exactly one primary household at a time.
- A parent account has at most one parent/admin household membership at a time.
- A money-enabled household has exactly one primary payout parent at a time.
- A responsibilities/routines-only household can complete setup without payout parent or pay cycle requirements.
- Changing primary household or payout parent affects future credits only.
- A chore template assigned to multiple children creates separate child-specific instances.
- Editing a chore template affects future generated instances only.
- Existing instances retain value, evidence requirement, assignment, and due-window snapshots.
- Instance generation is idempotent for template, assignee/up-for-grabs slot, occurrence date, and due window.
- Up-for-grabs instances can be claimed once.
- Claimed up-for-grabs instances cannot be submitted by another child.
- Approval-required chores cannot create payable credit before approval.
- Pending credits are informational only and cannot be included in payout closeout.
- No-approval money-producing chores auto-credit on valid submission completion.
- Approved chore earnings belong to the pay period containing the approval date.
- Approved earnings use the child's primary household and payout parent at credit time.
- Ledger transactions are append-only.
- Corrections use compensating manual adjustment transactions.
- Payout closeout marks a period paid without deleting ledger history.
- `allowance-included` chores count for expectations but do not create extra credit.
- Unpaid chores/routines count for expectations but do not create ledger activity.
- Money-disabled households do not create ledger activity for chore/routine completion.
- Missed chores auto-expire after the due window with zero credit.
- Parents can reopen expired chores.
- Rejected chores preserve feedback and can be resubmitted on the same instance.
- If a rejected chore is past due, child resubmission requires parent reopen.
- Completion photos are deleted after payout closeout while submission/approval history remains.
- Parents can delete submitted photos at any point without deleting history.
- Web push notification events also create in-app inbox items.
- Offline queued submissions use idempotency keys and cannot duplicate submissions or credits.

## 4) MVP implementation phase-by-phase requirements

### MVP Phase 1 - Foundation
- Auth and role tests for parent and child users.
- Household membership and admin invite tests.
- Child profile, primary household, and payout parent constraint tests.
- Household money-enabled and money-disabled setup tests.
- Availability base pattern and override tests.
- Chore template CRUD permission tests.
- Schedule generation tests for daily, weekly, interval, and one-off templates.
- Idempotent instance generation tests.
- Timezone tests for household-local due windows.

### MVP Phase 2 - Kid execution
- Child home query tests for Today, This Week, and Whenever.
- Submit chore with no photo required.
- Submit chore with photo required.
- Submit approval-required chore and verify it is waiting for approval.
- Submit no-approval money-producing chore and verify auto-credit behavior.
- Submit unpaid chore/routine and verify no ledger row is created.
- Submit allowance-included chore and verify no extra ledger credit is created.
- Up-for-grabs claim success.
- Up-for-grabs double-claim prevention.
- Claimed chore visibility and ownership tests.
- Offline queued submission and retry tests.
- Mobile large-text checks for child home, chore detail, claim, and submit.

### MVP Phase 3 - Parent operations
- Parent approval queue permission tests.
- Approve submission and create approved credit.
- Reject submission with feedback.
- Resubmit rejected chore before due window closes.
- Request reopen after due window.
- Parent reopen expired/rejected chore.
- Approval notification event and in-app inbox tests.
- Parent dashboard tests for today's status and pending approvals.

### MVP Phase 4 - Optional money
- Household money feature setting tests.
- Responsibilities/routines-only households skip pay-cycle and payout requirements.
- Pay cycle setting tests for weekly, biweekly, monthly date, and monthly weekday.
- Pay period generation tests with timezone boundaries.
- Approval-date pay period assignment tests.
- Earning household vs payout household tests.
- Payout parent ownership tests.
- Pending-credit exclusion from payout closeout.
- Manual adjustment tests.
- Payout closeout transaction tests.
- Append-only ledger tests.
- Primary household/payout parent future-only change tests.
- Parent payout queue E2E test.

### MVP Phase 5 - Notifications and polish
- Web push event creation tests.
- In-app inbox fallback tests.
- Quiet failure/retry tests for notification delivery.
- Photo cleanup after payout closeout.
- Parent manual photo deletion.
- Accessibility regression pass for all core child and parent flows.
- Desktop parent/admin review for setup, history, and optional payout workflows.

## 5) UI definition of done

A UI feature is not complete until:

- It works on mobile viewport sizes first.
- Parent/admin workflows also work on desktop where applicable.
- It is checked at large and largest iOS text sizes.
- Primary actions remain visible and reachable.
- Text does not clip, overlap, or require horizontal scrolling.
- Tap targets are large enough for comfortable mobile use.
- Status is communicated with text, not color alone.
- Empty, loading, offline, syncing, success, and error states are present.
- VoiceOver labels and focus order are acceptable for the core path.
- Password fields provide a clear show/hide control so parents and children can verify what they typed.

## 6) Optional money and permission definition of done

An optional money or permission feature is not complete until:

- Service-layer tests cover the happy path and denied path.
- RLS/database tests cover cross-household access denial.
- Ledger writes are covered by transaction tests.
- Unpaid, allowance-included, and money-disabled approval/completion paths prove they do not create ledger rows.
- Payout and pay-period flows are inaccessible or unnecessary for responsibilities/routines-only households.
- Duplicate request/idempotency behavior is tested.
- Audit log behavior is tested for sensitive actions.
- At least one regression test exists for any bug found during implementation.

## 7) Test data scenarios

Maintain fixtures for these scenarios:

- Single household with one parent and one child.
- Single household with two parents and two children.
- Split-household child with Dad household as primary payout household and Mom household as earning household.
- Child with repeating custody pattern and summer/holiday overrides.
- Approval-required fixed-value chore with photo required.
- No-approval fixed-value chore.
- `allowance-included` chore.
- Unpaid chore/routine.
- Responsibilities/routines-only household with no pay cycle.
- Up-for-grabs chore claimed by one child while another child attempts to claim.
- Rejected chore resubmitted before due window.
- Rejected chore requiring reopen after due window.
- Expired chore reopened by parent.
- Pay period with pending, approved, manual adjustment, and payout transactions.

## 8) Regression log

Add notable bugs here as they are found. Each entry should include the bug, the fix, and the test added.

- None yet.

## 9) UI polish backlog

- None yet.

## 10) Current local SQL smoke tests

- `supabase/tests/command_smoke.sql` exercises child submission with photo proof, parent approval, approved-credit ledger creation, payout closeout, payout ledger creation, and photo deletion metadata.
- `supabase/tests/auth_bootstrap_smoke.sql` exercises parent and child profile creation from `auth.users` metadata.
- `supabase/tests/onboarding_smoke.sql` exercises parent household creation with admin membership, primary payout parent, and biweekly pay cycle setup.
- `supabase/tests/optional_money_smoke.sql` exercises chores-only household setup, paid chore rejection when money is disabled, and unpaid chore approval without ledger/pay-period writes.
- `supabase/tests/child_invite_smoke.sql` exercises parent child-invite creation and child acceptance into household membership and child profile.
- `supabase/tests/parent_invite_smoke.sql` exercises admin parent-invite creation, invited parent acceptance into household membership, and disconnection from a previous parent household.
- `supabase/tests/availability_smoke.sql` exercises parent upsert of a child base availability pattern, override creation, and override deletion.
