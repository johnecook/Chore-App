"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentParentHouseholdId, requireCurrentProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createParentInviteSchema = z.object({
  parentEmail: z.email(),
});

const createChildInviteSchema = z.object({
  childName: z.string().trim().min(1).max(80),
  childEmail: z.email(),
});

const updateHouseholdSchema = z.object({
  householdName: z.string().trim().min(1).max(120),
  householdTimezone: z.string().trim().min(1).max(80),
});

const updateParentRoleSchema = z.object({
  parentUserId: z.uuid(),
  role: z.enum(["admin", "parent"]),
});

const updateChildAllowanceSchema = z.object({
  childProfileId: z.uuid(),
  allowanceEnabled: z.boolean(),
  baseAllowanceDollars: z.string().trim().regex(/^\d+(\.\d{1,2})?$/).optional(),
}).refine(
  (value) => !value.allowanceEnabled || dollarsToCents(value.baseAllowanceDollars ?? "0") > 0,
  {
    message: "Enter an allowance amount.",
    path: ["baseAllowanceDollars"],
  },
);

function householdSetupError(message: string): never {
  redirect(`/parent/household?error=${encodeURIComponent(message)}`);
}

function dollarsToCents(value: string) {
  const [dollars, cents = ""] = value.split(".");
  return Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
}

async function requireAdminHousehold() {
  const [profile, householdId] = await Promise.all([
    requireCurrentProfile(),
    getCurrentParentHouseholdId(),
  ]);

  if (profile.appRole === "child") {
    redirect("/kid");
  }

  if (!householdId) {
    redirect("/onboarding/household");
  }

  const supabase = await createSupabaseServerClient();
  const { data: membership, error } = await supabase
    .from("household_memberships")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", profile.id)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    householdSetupError(error.message);
  }

  if (!membership) {
    householdSetupError("Only a household admin can manage household settings.");
  }

  return { householdId, profile, supabase };
}

export async function createParentInviteAction(formData: FormData) {
  const parsed = createParentInviteSchema.safeParse({
    parentEmail: formData.get("parentEmail"),
  });

  if (!parsed.success) {
    householdSetupError("Enter a valid parent email.");
  }

  const { householdId, supabase } = await requireAdminHousehold();
  const { data, error } = await supabase.rpc("create_parent_invitation", {
    target_household_id: householdId,
    parent_email: parsed.data.parentEmail,
  });

  if (error || !data) {
    householdSetupError(error?.message ?? "Could not create parent invitation.");
  }

  redirect(`/parent/household?invited=${data}`);
}

export async function createChildInviteAction(formData: FormData) {
  const parsed = createChildInviteSchema.safeParse({
    childName: formData.get("childName"),
    childEmail: formData.get("childEmail"),
  });

  if (!parsed.success) {
    householdSetupError("Enter the child's name and a valid email.");
  }

  const { householdId, supabase } = await requireAdminHousehold();
  const { data, error } = await supabase.rpc("create_child_invitation", {
    target_household_id: householdId,
    child_email: parsed.data.childEmail,
    child_display_name: parsed.data.childName,
  });

  if (error || !data) {
    householdSetupError(error?.message ?? "Could not create child invitation.");
  }

  redirect(`/parent/household?invited=${data}`);
}

export async function updateHouseholdAction(formData: FormData) {
  const parsed = updateHouseholdSchema.safeParse({
    householdName: formData.get("householdName"),
    householdTimezone: formData.get("householdTimezone"),
  });

  if (!parsed.success) {
    householdSetupError("Enter a household name and timezone.");
  }

  const { householdId, supabase } = await requireAdminHousehold();
  const { error } = await supabase
    .from("households")
    .update({
      name: parsed.data.householdName,
      timezone: parsed.data.householdTimezone,
    })
    .eq("id", householdId);

  if (error) {
    householdSetupError(error.message);
  }

  revalidatePath("/parent/household");
  redirect("/parent/household?saved=1");
}

export async function updateParentRoleAction(formData: FormData) {
  const parsed = updateParentRoleSchema.safeParse({
    parentUserId: formData.get("parentUserId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    householdSetupError("Choose a valid parent role.");
  }

  const { householdId, profile, supabase } = await requireAdminHousehold();

  if (parsed.data.parentUserId === profile.id) {
    householdSetupError("Admins cannot change their own household role.");
  }

  const { error } = await supabase
    .from("household_memberships")
    .update({ role: parsed.data.role })
    .eq("household_id", householdId)
    .eq("user_id", parsed.data.parentUserId)
    .in("role", ["admin", "parent"]);

  if (error) {
    householdSetupError(error.message);
  }

  revalidatePath("/parent/household");
  redirect("/parent/household?saved=1");
}

export async function updateChildAllowanceAction(formData: FormData) {
  const parsed = updateChildAllowanceSchema.safeParse({
    childProfileId: formData.get("childProfileId"),
    allowanceEnabled: formData.get("allowanceEnabled") === "on",
    baseAllowanceDollars: String(formData.get("baseAllowanceDollars") ?? "").trim() || undefined,
  });

  if (!parsed.success) {
    householdSetupError("Enter a valid allowance amount.");
  }

  const amountCents = parsed.data.allowanceEnabled
    ? dollarsToCents(parsed.data.baseAllowanceDollars ?? "0")
    : 0;

  const { householdId, supabase } = await requireAdminHousehold();
  const { data: updatedChildProfile, error } = await supabase
    .from("child_profiles")
    .update({
      allowance_enabled: parsed.data.allowanceEnabled,
      base_allowance_cents: amountCents,
    })
    .eq("id", parsed.data.childProfileId)
    .eq("primary_household_id", householdId)
    .select("id")
    .maybeSingle();

  if (error) {
    householdSetupError(error.message);
  }

  if (!updatedChildProfile) {
    householdSetupError("That child profile could not be found in this household.");
  }

  revalidatePath("/parent/household");
  redirect("/parent/household?saved=1");
}
