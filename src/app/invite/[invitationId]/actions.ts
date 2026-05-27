"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const acceptInvitationSchema = z.object({
  invitationId: z.uuid(),
});

function inviteError(invitationId: string, message: string): never {
  redirect(`/invite/${invitationId}?error=${encodeURIComponent(message)}`);
}

export async function acceptChildInvitationAction(formData: FormData) {
  const rawInvitationId = String(formData.get("invitationId") ?? "");
  const parsed = acceptInvitationSchema.safeParse({
    invitationId: rawInvitationId,
  });

  if (!parsed.success) {
    inviteError(rawInvitationId, "This invitation link is not valid.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("accept_child_invitation", {
    target_invitation_id: parsed.data.invitationId,
  });

  if (error) {
    inviteError(parsed.data.invitationId, error.message);
  }

  redirect("/kid");
}
