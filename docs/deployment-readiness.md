# Rhythm MVP Deployment Readiness

Use this checklist before pushing the MVP to hosted Supabase and Vercel.

## Supabase

- Create or link the hosted Supabase project.
- Apply every migration in `supabase/migrations` in timestamp order.
- Confirm the `chore-submission-photos` storage bucket exists with the policies from the migrations.
- Run `npm run test:db` against the hosted database using `SUPABASE_DB_URL` or `DATABASE_URL`.
- Copy these values into Vercel environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Vercel

- Connect the GitHub repository to a Vercel project.
- Set the same environment variables from `.env.example`.
- Use `npm run build` as the build command.
- Keep the output setting as the Next.js default.
- Deploy a preview build first, then verify the smoke checklist below before promoting to production.

## MVP Smoke Checklist

- Parent can sign in and land on `/parent`.
- Parent can sync schedule, create a chore, edit a chore, and deactivate/reactivate it.
- Parent can invite a child and a parent from `/parent/household`.
- Child can accept an invite and see assigned or available chores on `/kid`.
- Child can claim an up-for-grabs chore.
- Child can submit a chore with checklist items and optional photo proof.
- Parent can approve, reject, reopen, and delete submitted photo proof.
- Money-enabled household shows balances, adjustments, payout queue, and ledger.
- Money-disabled household does not require pay-cycle or payout workflows.
- Notifications can be marked read and actioned from `/notifications`.
- Mobile and desktop views have no horizontal scrolling, clipped text, or unreachable primary actions.
