"use server";

import { redirect } from "next/navigation";
import {
  appendChoreTemplateFormParams,
  choreTemplateCommandErrorMessage,
  choreTemplateFormValues,
  editChoreTemplateFormSchema,
  optionalString,
  orderRotationChildren,
  validationErrorMessage,
} from "@/app/parent/chores/form-validation";
import { requireCurrentParentHouseholdId } from "@/lib/auth/session";
import { updateChoreTemplateBasics } from "@/lib/supabase/chore-commands";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function editChoreTemplateError(templateId: string, message: string, formData: FormData): never {
  const params = new URLSearchParams({
    draft: "1",
    error: message,
  });

  appendChoreTemplateFormParams(params, formData);
  redirect(`/parent/chores/${templateId}/edit?${params.toString()}`);
}

export async function updateChoreTemplateAction(formData: FormData) {
  const parsed = editChoreTemplateFormSchema.safeParse({
    templateId: formData.get("templateId"),
    ...choreTemplateFormValues(formData),
  });

  const fallbackTemplateId = optionalString(formData.get("templateId"));

  if (!parsed.success) {
    if (fallbackTemplateId) {
      editChoreTemplateError(fallbackTemplateId, validationErrorMessage(parsed.error), formData);
    }

    redirect("/parent?error=That chore template could not be updated.");
  }

  if (
    parsed.data.valueModel === "fixed" &&
    (!parsed.data.amountDollars || parsed.data.amountDollars <= 0)
  ) {
    editChoreTemplateError(parsed.data.templateId, "Enter an amount for fixed-value chores.", formData);
  }

  const householdId = await requireCurrentParentHouseholdId();
  const supabase = await createSupabaseServerClient();
  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("money_features_enabled")
    .eq("id", householdId)
    .maybeSingle();

  if (householdError) {
    editChoreTemplateError(parsed.data.templateId, householdError.message, formData);
  }

  if (parsed.data.valueModel === "fixed" && !household?.money_features_enabled) {
    editChoreTemplateError(parsed.data.templateId, "Enable money features before creating paid chores.", formData);
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
      scheduleType: parsed.data.scheduleType,
      startDate: parsed.data.startDate,
      weeklyWeekdays: parsed.data.scheduleType === "weekly" ? parsed.data.weeklyWeekdays : null,
      intervalDays: parsed.data.scheduleType === "interval" ? parsed.data.intervalDays : null,
      oneOffDate: parsed.data.scheduleType === "one_off" ? parsed.data.oneOffDate : null,
      dueTimeStart: parsed.data.dueTimeStart ?? null,
      dueTimeEnd: parsed.data.dueTimeEnd ?? null,
      assignmentMode: parsed.data.assignmentMode,
      rotationCadence: parsed.data.assignmentMode === "rotation" ? parsed.data.rotationCadence : null,
      rotationChildScope: parsed.data.assignmentMode === "rotation" ? parsed.data.rotationChildScope : null,
      rotationStartChildProfileId:
        parsed.data.assignmentMode === "rotation" ? parsed.data.rotationStartChildProfileId ?? null : null,
      valueModel: parsed.data.valueModel,
      amountCents,
      photoRequired: parsed.data.photoRequired,
      approvalRequired: parsed.data.approvalRequired,
      selectedChildProfileIds:
        parsed.data.assignmentMode === "selected_children" ||
        (parsed.data.assignmentMode === "rotation" && parsed.data.rotationChildScope === "selected_children")
          ? orderRotationChildren(parsed.data.selectedChildProfileIds, parsed.data.rotationStartChildProfileId)
          : [],
      checklistItems: parsed.data.checklistItems,
    });
  } catch (error) {
    editChoreTemplateError(
      parsed.data.templateId,
      choreTemplateCommandErrorMessage(error, "Could not update chore."),
      formData,
    );
  }

  redirect(`/parent/chores?updatedTemplate=${templateId}`);
}
