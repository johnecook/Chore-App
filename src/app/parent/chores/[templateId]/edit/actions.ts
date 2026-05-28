"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentParentHouseholdId } from "@/lib/auth/session";
import { updateChoreTemplateBasics } from "@/lib/supabase/chore-commands";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const scheduleTypeSchema = z.enum(["daily", "weekly", "interval", "one_off"]);
const assignmentModeSchema = z.enum(["selected_children", "all_eligible_children", "up_for_grabs"]);
const valueModelSchema = z.enum(["fixed", "allowance_included", "unpaid"]);

const editChoreTemplateFormSchema = z
  .object({
    templateId: z.uuid(),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    scheduleType: scheduleTypeSchema,
    startDate: z.iso.date(),
    weeklyWeekdays: z.array(z.coerce.number().int().min(0).max(6)),
    intervalDays: z.coerce.number().int().min(1).max(365).optional(),
    oneOffDate: z.iso.date().optional(),
    dueTimeStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    dueTimeEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    assignmentMode: assignmentModeSchema,
    valueModel: valueModelSchema,
    amountDollars: z.coerce.number().min(0).max(9999).optional(),
    selectedChildProfileIds: z.array(z.uuid()),
    photoRequired: z.boolean(),
    approvalRequired: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.scheduleType === "weekly" && data.weeklyWeekdays.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["weeklyWeekdays"],
        message: "Choose at least one weekday.",
      });
    }

    if (data.scheduleType === "interval" && !data.intervalDays) {
      ctx.addIssue({
        code: "custom",
        path: ["intervalDays"],
        message: "Enter an interval.",
      });
    }

    if (data.scheduleType === "one_off" && !data.oneOffDate) {
      ctx.addIssue({
        code: "custom",
        path: ["oneOffDate"],
        message: "Choose a one-off date.",
      });
    }

    if (data.assignmentMode === "selected_children" && data.selectedChildProfileIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["selectedChildProfileIds"],
        message: "Choose at least one child.",
      });
    }

    if (data.valueModel === "fixed" && (!data.amountDollars || data.amountDollars <= 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["amountDollars"],
        message: "Enter an amount for fixed-value chores.",
      });
    }

    if (data.dueTimeStart && data.dueTimeEnd && data.dueTimeStart >= data.dueTimeEnd) {
      ctx.addIssue({
        code: "custom",
        path: ["dueTimeEnd"],
        message: "Due window end must be after the start.",
      });
    }
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
    scheduleType: formData.get("scheduleType"),
    startDate: formData.get("startDate"),
    weeklyWeekdays: formData.getAll("weeklyWeekdays"),
    intervalDays: optionalString(formData.get("intervalDays")),
    oneOffDate: optionalString(formData.get("oneOffDate")),
    dueTimeStart: optionalString(formData.get("dueTimeStart")),
    dueTimeEnd: optionalString(formData.get("dueTimeEnd")),
    assignmentMode: formData.get("assignmentMode"),
    valueModel: formData.get("valueModel"),
    amountDollars: optionalString(formData.get("amountDollars")),
    selectedChildProfileIds: formData.getAll("selectedChildProfileIds"),
    photoRequired: formData.get("photoRequired") === "on",
    approvalRequired: formData.get("approvalRequired") === "on",
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
      scheduleType: parsed.data.scheduleType,
      startDate: parsed.data.startDate,
      weeklyWeekdays: parsed.data.scheduleType === "weekly" ? parsed.data.weeklyWeekdays : null,
      intervalDays: parsed.data.scheduleType === "interval" ? parsed.data.intervalDays : null,
      oneOffDate: parsed.data.scheduleType === "one_off" ? parsed.data.oneOffDate : null,
      dueTimeStart: parsed.data.dueTimeStart ?? null,
      dueTimeEnd: parsed.data.dueTimeEnd ?? null,
      assignmentMode: parsed.data.assignmentMode,
      valueModel: parsed.data.valueModel,
      amountCents,
      photoRequired: parsed.data.photoRequired,
      approvalRequired: parsed.data.approvalRequired,
      selectedChildProfileIds:
        parsed.data.assignmentMode === "selected_children" ? parsed.data.selectedChildProfileIds : [],
    });
  } catch (error) {
    editChoreTemplateError(
      parsed.data.templateId,
      error instanceof Error ? error.message : "Could not update chore.",
    );
  }

  redirect(`/parent/chores?updatedTemplate=${templateId}`);
}
