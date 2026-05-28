import Link from "next/link";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/notifications/actions";
import { SignOutButton } from "@/components/sign-out-button";
import { requireCurrentProfile } from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type NotificationEvent = Database["public"]["Tables"]["notification_events"]["Row"];

function eventLabel(eventType: NotificationEvent["event_type"]) {
  switch (eventType) {
    case "chore_available":
      return "Available";
    case "chore_submitted":
      return "Submitted";
    case "chore_approved":
      return "Approved";
    case "chore_rejected":
      return "Sent back";
    case "chore_reopened":
      return "Reopened";
  }
}

function formatNotificationTime(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function homePathForRole(role: "parent" | "child") {
  return role === "child" ? "/kid" : "/parent";
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; read?: string }>;
}) {
  const [profile, params] = await Promise.all([requireCurrentProfile(), searchParams]);
  const supabase = await createSupabaseServerClient();
  const { data: notifications, error } = await supabase
    .from("notification_events")
    .select(
      "id, recipient_profile_id, household_id, actor_profile_id, chore_instance_id, chore_submission_id, event_type, title, body, metadata, read_at, created_at",
    )
    .eq("recipient_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  const unreadCount = notifications?.filter((notification) => !notification.read_at).length ?? 0;

  return (
    <main className="page-shell">
      <div className="grid gap-8 py-6">
        <header className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              className="text-base font-semibold text-[var(--accent-strong)]"
              href={homePathForRole(profile.appRole)}
            >
              Chores
            </Link>
            <SignOutButton />
          </div>
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold leading-tight">Notifications</h1>
            <p className="text-lg text-[var(--muted)]">
              {unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}.` : "You are caught up."}
            </p>
          </div>
        </header>

        {params.error ? (
          <p className="rounded-lg border border-[var(--danger)] bg-white p-4 text-lg font-medium text-[var(--danger)]">
            {params.error}
          </p>
        ) : null}

        {params.read ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg font-medium">
            Notifications updated.
          </p>
        ) : null}

        <nav aria-label="Notification navigation" className="grid gap-3 sm:grid-cols-2">
          <Link
            className="rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-center text-lg font-semibold"
            href={homePathForRole(profile.appRole)}
          >
            Back to {profile.appRole === "child" ? "kid home" : "parent dashboard"}
          </Link>
          <form action={markAllNotificationsReadAction}>
            <button
              className="min-h-12 w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-lg font-semibold text-white disabled:opacity-60"
              disabled={unreadCount === 0}
            >
              Mark all read
            </button>
          </form>
        </nav>

        <section aria-labelledby="notification-list-heading" className="grid gap-3">
          <h2 id="notification-list-heading" className="text-xl font-semibold">
            Recent updates
          </h2>
          {notifications?.length ? (
            <div className="grid gap-3">
              {notifications.map((notification) => (
                <article
                  className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4"
                  key={notification.id}
                >
                  <div className="grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold leading-snug">{notification.title}</h3>
                      <span className="rounded-md border border-[var(--line)] px-2 py-1 text-base font-semibold text-[var(--muted)]">
                        {eventLabel(notification.event_type)}
                      </span>
                      {!notification.read_at ? (
                        <span className="rounded-md bg-[var(--accent)] px-2 py-1 text-base font-semibold text-white">
                          New
                        </span>
                      ) : null}
                    </div>
                    <p className="text-lg">{notification.body}</p>
                    <p className="text-base text-[var(--muted)]">
                      {formatNotificationTime(notification.created_at)}
                    </p>
                  </div>

                  {!notification.read_at ? (
                    <form action={markNotificationReadAction}>
                      <input name="notificationId" type="hidden" value={notification.id} />
                      <button className="min-h-11 rounded-lg border border-[var(--line)] bg-white px-4 py-2 text-base font-semibold text-[var(--accent-strong)]">
                        Mark read
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-[var(--line)] bg-white p-4 text-lg text-[var(--muted)]">
              No notifications yet.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
