"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentParentHouseholdId } from "@/lib/auth/session";
import { updateChoreTemplateBasics } from "@/lib/supabase/chore-commands";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const valueModelSchema = z.enum(["fixed", "allowance_included", "unpaid"]);

const editChoreTemplateFormSchema = z.object({
  templateId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  valueModel: valueModelSchema,
  amountDollars: z.coerce.number().min(0).max(9999).optional(),
});

function optionalString(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();
  return stringValue.length ? stringValue : undefined;
}

function editChoreTemplateError(templateId: string, message: string): never {
  redirect(`/parent/chores/${templateId}/edit?error=${encodeURIComponent(message)}`);
}

export async function updateChoreTemplateAction(formData: FormData) {
  const parsed = editChoreTemplateFormSchema.safeParse({
    templateId: formData.get("templateId"),
    title: formData.get("title"),
    description: optionalString(formData.get("description")),
    valueModel: formData.get("valueModel"),
    amountDollars: optionalString(formData.get("amountDollars")),
  });

  const fallbackTemplateId = optionalString(formData.get("templateId"));

  if (!parsed.success) {
    if (fallbackTemplateId) {
      editChoreTemplateError(fallbackTemplateId, "Check the chore details and try again.");
    }

    redirect("/parent?error=That chore template could not be updated.");
  }

  if (
    parsed.data.valueModel === "fixed" &&
    (!parsed.data.amountDollars || parsed.data.amountDollars <= 0)
  ) {
    editChoreTemplateError(parsed.data.templateId, "Enter an amount for fixed-value chores.");
  }

  const householdId = await requireCurrentParentHouseholdId();
  const supabase = await createSupabaseServerClient();
  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("money_features_enabled")
    .eq("id", householdId)
    .maybeSingle();

  if (householdError) {
    editChoreTemplateError(parsed.data.templateId, householdError.message);
  }

  if (parsed.data.valueModel === "fixed" && !household?.money_features_enabled) {
    editChoreTemplateError(parsed.data.templateId, "Enable money features before creating paid chores.");
  }

  const amountCents =
    parsed.data.valueModel === "fixed" ? Math.round((parsed.data.amountDollars ?? 0) * 100) : 0;

  let templateId: string;

  try {
    templateId = await updateChoreTemplateBasics(supabase, {
      householdId,
      templateId: parsed.data.templateId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      valueModel: parsed.data.valueModel,
      amountCents,
    });
  } catch (error) {
    editChoreTemplateError(
      parsed.data.templateId,
      error instanceof Error ? error.message : "Could not update chore.",
    );
  }

  redirect(`/parent/chores?updatedTemplate=${templateId}`);
}
