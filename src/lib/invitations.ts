import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InviteSignupContext = {
  id: string;
  email: string;
  role: "parent" | "child";
  childDisplayName: string | null;
};

export async function getInviteSignupContext(
  invitationId: string | null | undefined,
): Promise<InviteSignupContext | null> {
  if (!invitationId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("get_invite_signup_context", {
      target_invitation_id: invitationId,
    })
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || (data.role !== "parent" && data.role !== "child")) {
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    role: data.role,
    childDisplayName: data.child_display_name,
  };
}
