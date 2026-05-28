"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentProfile } from "@/lib/auth/session";
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
