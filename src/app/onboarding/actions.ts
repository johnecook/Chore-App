"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createHouseholdSchema = z.object({
  householdName: z.string().trim().min(1).max(80),
  householdTimezone: z.string().trim().min(1).max(80),
  moneyFeaturesEnabled: z.boolean(),
  payCycle: z.enum(["weekly", "biweekly"]).optional(),
  payWeekday: z.coerce.number().int().min(0).max(6).optional(),
  biweeklyAnchorDate: z.iso.date().optional(),
}).refine(
  (value) => !value.moneyFeaturesEnabled || value.payCycle,
  {
    message: "Choose a payout schedule or turn money features off.",
    path: ["payCycle"],
  },
).refine(
  (value) => !value.moneyFeaturesEnabled || value.payWeekday !== undefined,
  {
    message: "Choose a payout day or turn money features off.",
    path: ["payWeekday"],
  },
).refine(
  (value) =>
    !value.moneyFeaturesEnabled || value.payCycle === "weekly" || value.biweeklyAnchorDate,
  {
    message: "Choose the first payout date for an every-two-weeks schedule.",
    path: ["biweeklyAnchorDate"],
  },
);

const joinHouseholdSchema = z.object({
  invitationId: z.uuid(),
});

function onboardingError(message: string): never {
  redirect(`/onboarding/household?error=${encodeURIComponent(message)}`);
}

export async function createHouseholdAction(formData: FormData) {
  const parsed = createHouseholdSchema.safeParse({
    householdName: formData.get("householdName"),
    householdTimezone: formData.get("householdTimezone"),
    moneyFeaturesEnabled: formData.get("moneyFeaturesEnabled") === "on",
    payCycle: formData.get("payCycle"),
    payWeekday: formData.get("payWeekday"),
    biweeklyAnchorDate: formData.get("biweeklyAnchorDate") || undefined,
  });

  if (!parsed.success) {
    onboardingError("Enter a household name and choose valid household settings.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_parent_household", {
    household_name: parsed.data.householdName,
    household_timezone: parsed.data.householdTimezone,
    money_features_enabled: parsed.data.moneyFeaturesEnabled,
    pay_weekday: parsed.data.payWeekday ?? null,
    pay_cycle: parsed.data.payCycle ?? null,
    biweekly_anchor_date: parsed.data.payCycle === "biweekly" ? parsed.data.biweeklyAnchorDate : null,
  });

  if (error) {
    onboardingError(error.message);
  }

  redirect("/parent");
}

export async function joinParentHouseholdAction(formData: FormData) {
  const parsed = joinHouseholdSchema.safeParse({
    invitationId: formData.get("invitationId"),
  });

  if (!parsed.success) {
    onboardingError("Enter a valid household invite code.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("accept_parent_invitation", {
    target_invitation_id: parsed.data.invitationId,
  });

  if (error) {
    onboardingError(error.message);
  }

  redirect("/parent");
}
