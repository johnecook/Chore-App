"use server";

import { redirect } from "next/navigation";
import {
  appendChoreTemplateFormParams,
  choreTemplateCommandErrorMessage,
  choreTemplateFormValues,
  createChoreTemplateFormSchema,
  optionalString,
  orderRotationChildren,
  validationErrorMessage,
} from "@/app/parent/chores/form-validation";
import { requireCurrentParentHouseholdId } from "@/lib/auth/session";
import { createChoreTemplate } from "@/lib/supabase/chore-commands";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function choreSetupError(message: string, formData: FormData): never {
  redirect(createChoreErrorPath(message, formData));
}

function createChoreErrorPath(message: string, formData: FormData) {
  const params = new URLSearchParams({
    draft: "1",
    error: message,
  });
  const presetId = optionalString(formData.get("presetId"));

  if (presetId) {
    params.set("preset", presetId);
  }

  appendChoreTemplateFormParams(params, formData);

  return `/parent/chores/new?${params.toString()}`;
}

export async function createChoreTemplateAction(formData: FormData) {
  const parsed = createChoreTemplateFormSchema.safeParse(choreTemplateFormValues(formData));

  if (!parsed.success) {
    choreSetupError(validationErrorMessage(parsed.error), formData);
  }

  const householdId = await requireCurrentParentHouseholdId();
  const amountCents =
    parsed.data.valueModel === "fixed" ? Math.round((parsed.data.amountDollars ?? 0) * 100) : 0;

  const supabase = await createSupabaseServerClient();
  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("money_features_enabled")
    .eq("id", householdId)
    .maybeSingle();

  if (householdError) {
    choreSetupError(householdError.message, formData);
  }

  if (parsed.data.valueModel === "fixed" && !household?.money_features_enabled) {
    choreSetupError("Enable money features before creating paid chores.", formData);
  }

  let templateId: string;

  try {
    templateId = await createChoreTemplate(supabase, {
      householdId,
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
    choreSetupError(choreTemplateCommandErrorMessage(error, "Could not create chore."), formData);
  }

  redirect(`/parent/chores?createdChore=${templateId}`);
}
