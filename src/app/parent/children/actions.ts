"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentParentHouseholdId } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createChildInviteSchema = z.object({
  childName: z.string().trim().min(1).max(80),
  childEmail: z.email(),
});

function childSetupError(message: string): never {
  redirect(`/parent/children?error=${encodeURIComponent(message)}`);
}

export async function createChildInviteAction(formData: FormData) {
  const parsed = createChildInviteSchema.safeParse({
    childName: formData.get("childName"),
    childEmail: formData.get("childEmail"),
  });

  if (!parsed.success) {
    childSetupError("Enter the child's name and a valid email.");
  }

  const householdId = await getCurrentParentHouseholdId();

  if (!householdId) {
    redirect("/onboarding/household");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_child_invitation", {
    target_household_id: householdId,
    child_email: parsed.data.childEmail,
    child_display_name: parsed.data.childName,
  });

  if (error || !data) {
    childSetupError(error?.message ?? "Could not create child invitation.");
  }

  redirect(`/parent/children?invited=${data}`);
}
