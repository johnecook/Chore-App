"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentProfile } from "@/lib/auth/session";
import { claimChoreInstance } from "@/lib/supabase/chore-commands";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const notificationSchema = z.object({
  notificationId: z.uuid(),
});

function notificationError(message: string): never {
  redirect(`/notifications?error=${encodeURIComponent(message)}`);
}

export async function markNotificationReadAction(formData: FormData) {
  const parsed = notificationSchema.safeParse({
    notificationId: formData.get("notificationId"),
  });

  if (!parsed.success) {
    notificationError("That notification could not be updated.");
  }

  await requireCurrentProfile();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("mark_notification_events_read", {
    target_notification_id: parsed.data.notificationId,
  });

  if (error) {
    notificationError(error.message);
  }

  redirect("/notifications?read=1");
}

export async function markAllNotificationsReadAction() {
  await requireCurrentProfile();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("mark_notification_events_read", {
    target_notification_id: null,
  });

  if (error) {
    notificationError(error.message);
  }

  redirect("/notifications?read=1");
}

export async function claimNotificationChoreAction(formData: FormData) {
  const parsed = notificationSchema.safeParse({
    notificationId: formData.get("notificationId"),
  });

  if (!parsed.success) {
    notificationError("That chore could not be claimed.");
  }

  const profile = await requireCurrentProfile();

  if (profile.appRole !== "child") {
    notificationError("Only child accounts can claim available chores.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: notification, error: notificationLookupError } = await supabase
    .from("notification_events")
    .select("id, chore_instance_id, event_type")
    .eq("id", parsed.data.notificationId)
    .eq("recipient_profile_id", profile.id)
    .maybeSingle();

  if (notificationLookupError) {
    notificationError(notificationLookupError.message);
  }

  if (
    !notification ||
    notification.event_type !== "chore_available" ||
    !notification.chore_instance_id
  ) {
    notificationError("That notification is not claimable.");
  }

  let claimId: string;

  try {
    claimId = await claimChoreInstance(supabase, notification.chore_instance_id);
  } catch (error) {
    notificationError(error instanceof Error ? error.message : "Could not claim chore.");
  }

  const { error: readError } = await supabase.rpc("mark_notification_events_read", {
    target_notification_id: notification.id,
  });

  if (readError) {
    notificationError(readError.message);
  }

  redirect(`/kid?claimed=${claimId}`);
}
