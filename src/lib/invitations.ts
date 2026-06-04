import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

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

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("household_invitations")
    .select("id, email, role, child_display_name, accepted_at, revoked_at, expires_at")
    .eq("id", invitationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (
    !data ||
    data.accepted_at ||
    data.revoked_at ||
    new Date(data.expires_at).getTime() <= Date.now() ||
    (data.role !== "parent" && data.role !== "child")
  ) {
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    role: data.role,
    childDisplayName: data.child_display_name,
  };
}
