"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentParentHouseholdId } from "@/lib/auth/session";
import { createChoreTemplate } from "@/lib/supabase/chore-commands";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const scheduleTypeSchema = z.enum(["daily", "weekly", "interval", "one_off"]);
const assignmentModeSchema = z.enum(["selected_children", "all_eligible_children", "up_for_grabs", "rotation"]);
const rotationCadenceSchema = z.enum(["daily", "weekly", "monthly"]);
const rotationChildScopeSchema = z.enum(["all_children", "selected_children"]);
const valueModelSchema = z.enum(["fixed", "allowance_included", "unpaid"]);
const dateSchema = (message: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, message);
const timeSchema = (message: string) =>
  z
    .string()
    .regex(/^\d{2}:\d{2}(?::\d{2})?$/, message)
    .transform((value) => value.slice(0, 5));

const choreTemplateFormSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a chore title.").max(120, "Keep the title under 120 characters."),
    description: z.string().trim().max(500, "Keep the description under 500 characters.").optional(),
    scheduleType: scheduleTypeSchema,
    startDate: dateSchema("Choose a valid start date."),
    weeklyWeekdays: z.array(z.coerce.number().int().min(0).max(6)),
    intervalDays: z.coerce.number().int().min(1).max(365).optional(),
    oneOffDate: dateSchema("Choose a valid chore date.").optional(),
    dueTimeStart: timeSchema("Enter a valid due-after time.").optional(),
    dueTimeEnd: timeSchema("Enter a valid due-before time.").optional(),
    assignmentMode: assignmentModeSchema,
    rotationCadence: rotationCadenceSchema.optional(),
    rotationChildScope: rotationChildScopeSchema.optional(),
    rotationStartChildProfileId: z.uuid().optional(),
    valueModel: valueModelSchema,
    amountDollars: z.coerce.number().min(0).max(9999).optional(),
    selectedChildProfileIds: z.array(z.uuid()),
    checklistItems: z
      .array(z.string().trim().max(120, "Keep checklist items under 120 characters."))
      .max(20, "Use 20 or fewer checklist items."),
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
        message: "Choose a date.",
      });
    }

    if (data.assignmentMode === "selected_children" && data.selectedChildProfileIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["selectedChildProfileIds"],
        message: "Choose at least one child.",
      });
    }

    if (data.assignmentMode === "rotation" && (!data.rotationCadence || !data.rotationChildScope)) {
      ctx.addIssue({
        code: "custom",
        path: ["assignmentMode"],
        message: "Choose rotation cadence and children.",
      });
    }

    if (
      data.assignmentMode === "rotation" &&
      data.rotationChildScope === "selected_children" &&
      data.selectedChildProfileIds.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["selectedChildProfileIds"],
        message: "Choose at least one child for this rotation.",
      });
    }

    if (
      data.assignmentMode === "rotation" &&
      data.rotationChildScope === "selected_children" &&
      data.rotationStartChildProfileId &&
      !data.selectedChildProfileIds.includes(data.rotationStartChildProfileId)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["rotationStartChildProfileId"],
        message: "Choose a starting child included in this rotation.",
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

function choreSetupError(message: string, formData: FormData): never {
  redirect(createChoreErrorPath(message, formData));
}

function optionalString(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();
  return stringValue.length ? stringValue : undefined;
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

  for (const field of [
    "title",
    "description",
    "scheduleType",
    "startDate",
    "intervalDays",
    "oneOffDate",
    "dueTimeStart",
    "dueTimeEnd",
    "assignmentMode",
    "rotationCadence",
    "rotationChildScope",
    "rotationStartChildProfileId",
    "valueModel",
    "amountDollars",
  ]) {
    const value = formData.get(field);

    if (typeof value === "string") {
      params.set(field, value);
    }
  }

  for (const field of ["weeklyWeekdays", "selectedChildProfileIds", "checklistItems"]) {
    for (const value of formData.getAll(field)) {
      if (typeof value === "string") {
        params.append(field, value);
      }
    }
  }

  params.set("photoRequired", formData.get("photoRequired") === "on" ? "on" : "off");
  params.set("approvalRequired", formData.get("approvalRequired") === "on" ? "on" : "off");

  return `/parent/chores/new?${params.toString()}`;
}

function validationErrorMessage(error: z.ZodError) {
  const issue = error.issues[0];

  if (!issue) {
    return "Check the chore details and try again.";
  }

  if (issue.message && !issue.message.startsWith("Invalid")) {
    return issue.message;
  }

  const fieldName = issue.path[0];
  const fieldMessages: Record<string, string> = {
    amountDollars: "Enter a valid chore amount.",
    assignmentMode: "Choose how this chore is assigned.",
    dueTimeEnd: "Enter a valid due-before time.",
    dueTimeStart: "Enter a valid due-after time.",
    intervalDays: "Enter a valid interval.",
    oneOffDate: "Choose a valid chore date.",
    rotationCadence: "Choose how often this chore rotates.",
    rotationChildScope: "Choose which children are in this rotation.",
    rotationStartChildProfileId: "Choose a valid child to start the rotation.",
    scheduleType: "Choose a valid schedule type.",
    selectedChildProfileIds: "Choose a valid child.",
    startDate: "Choose a valid start date.",
    valueModel: "Choose a valid value type.",
    weeklyWeekdays: "Choose valid weekdays.",
  };

  return typeof fieldName === "string"
    ? (fieldMessages[fieldName] ?? "Check the chore details and try again.")
    : "Check the chore details and try again.";
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
    rotationCadence: optionalString(formData.get("rotationCadence")),
    rotationChildScope: optionalString(formData.get("rotationChildScope")),
    rotationStartChildProfileId: optionalString(formData.get("rotationStartChildProfileId")),
    valueModel: formData.get("valueModel"),
    amountDollars: optionalString(formData.get("amountDollars")),
    selectedChildProfileIds: formData.getAll("selectedChildProfileIds"),
    checklistItems: formData
      .getAll("checklistItems")
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0),
    photoRequired: formData.get("photoRequired") === "on",
    approvalRequired: formData.get("approvalRequired") === "on",
  });

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
    choreSetupError(error instanceof Error ? error.message : "Could not create chore.", formData);
  }

  redirect(`/parent/chores?createdChore=${templateId}`);
}

function orderRotationChildren(childProfileIds: string[], startChildProfileId?: string) {
  if (!startChildProfileId) {
    return childProfileIds;
  }

  return [
    startChildProfileId,
    ...childProfileIds.filter((childProfileId) => childProfileId !== startChildProfileId),
  ];
}
