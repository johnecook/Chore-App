"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentParentHouseholdId } from "@/lib/auth/session";
import { createChoreTemplate } from "@/lib/supabase/chore-commands";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const scheduleTypeSchema = z.enum(["daily", "weekly", "interval", "one_off"]);
const assignmentModeSchema = z.enum(["selected_children", "all_eligible_children", "up_for_grabs"]);
const valueModelSchema = z.enum(["fixed", "allowance_included", "unpaid"]);

const choreTemplateFormSchema = z
  .object({
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

function choreSetupError(message: string): never {
  redirect(`/parent/chores/new?error=${encodeURIComponent(message)}`);
}

function optionalString(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();
  return stringValue.length ? stringValue : undefined;
}

export async function createChoreTemplateAction(formData: FormData) {
  const parsed = choreTemplateFormSchema.safeParse({
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

  if (!parsed.success) {
    choreSetupError("Check the chore details and try again.");
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
    choreSetupError(householdError.message);
  }

  if (parsed.data.valueModel === "fixed" && !household?.money_features_enabled) {
    choreSetupError("Enable money features before creating paid chores.");
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
      valueModel: parsed.data.valueModel,
      amountCents,
      photoRequired: parsed.data.photoRequired,
      approvalRequired: parsed.data.approvalRequired,
      selectedChildProfileIds:
        parsed.data.assignmentMode === "selected_children" ? parsed.data.selectedChildProfileIds : [],
    });
  } catch (error) {
    choreSetupError(error instanceof Error ? error.message : "Could not create chore.");
  }

  redirect(`/parent/chores?createdChore=${templateId}`);
}
