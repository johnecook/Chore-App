import { z } from "zod";

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

const choreTemplateFieldsSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a chore title.").max(120, "Keep the title under 120 characters."),
    description: z.string().trim().max(500, "Keep the description under 500 characters.").optional(),
    scheduleType: scheduleTypeSchema,
    startDate: dateSchema("Choose a valid start date."),
    weeklyWeekdays: z.array(z.coerce.number().int().min(0).max(6)),
    intervalDays: z.coerce
      .number()
      .int("Enter a whole number of days.")
      .min(1, "Enter an interval of at least 1 day.")
      .max(365, "Keep the interval at 365 days or less.")
      .optional(),
    oneOffDate: dateSchema("Choose a valid chore date.").optional(),
    dueTimeStart: timeSchema("Enter a valid due-after time.").optional(),
    dueTimeEnd: timeSchema("Enter a valid due-before time.").optional(),
    assignmentMode: assignmentModeSchema,
    rotationCadence: rotationCadenceSchema.optional(),
    rotationChildScope: rotationChildScopeSchema.optional(),
    rotationStartChildProfileId: z.uuid().optional(),
    valueModel: valueModelSchema,
    amountDollars: z.coerce
      .number()
      .min(0, "Enter a chore amount of $0 or more.")
      .max(9999, "Keep the chore amount under $9,999.")
      .optional(),
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

    if (data.scheduleType === "one_off" && data.oneOffDate && data.oneOffDate < data.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["oneOffDate"],
        message: "Choose a chore date on or after the start date.",
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

export const createChoreTemplateFormSchema = choreTemplateFieldsSchema;
export const editChoreTemplateFormSchema = choreTemplateFieldsSchema.and(
  z.object({
    templateId: z.uuid(),
  }),
);

export function optionalString(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();
  return stringValue.length ? stringValue : undefined;
}

export function choreTemplateFormValues(formData: FormData) {
  return {
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
  };
}

export function appendChoreTemplateFormParams(params: URLSearchParams, formData: FormData) {
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
}

export function validationErrorMessage(error: z.ZodError) {
  const issue = error.issues[0];

  if (!issue) {
    return "Check the chore details and try again.";
  }

  if (
    issue.code === "custom" ||
    (issue.message && !issue.message.startsWith("Invalid") && !issue.message.startsWith("Too "))
  ) {
    return issue.message;
  }

  const fieldName = issue.path[0];
  const fieldMessages: Record<string, string> = {
    amountDollars: "Enter a valid chore amount.",
    approvalRequired: "Choose whether parent approval is required.",
    assignmentMode: "Choose how this chore is assigned.",
    checklistItems: "Check the checklist items.",
    description: "Check the chore description.",
    dueTimeEnd: "Enter a valid due-before time.",
    dueTimeStart: "Enter a valid due-after time.",
    intervalDays: "Enter a valid interval.",
    oneOffDate: "Choose a valid chore date.",
    photoRequired: "Choose whether photo proof is required.",
    rotationCadence: "Choose how often this chore rotates.",
    rotationChildScope: "Choose which children are in this rotation.",
    rotationStartChildProfileId: "Choose a valid child to start the rotation.",
    scheduleType: "Choose a valid schedule type.",
    selectedChildProfileIds: "Choose a valid child.",
    startDate: "Choose a valid start date.",
    templateId: "That chore template could not be updated.",
    title: "Enter a chore title.",
    valueModel: "Choose a valid value type.",
    weeklyWeekdays: "Choose valid weekdays.",
  };

  return typeof fieldName === "string"
    ? (fieldMessages[fieldName] ?? "Check the chore details and try again.")
    : "Check the chore details and try again.";
}

export function choreTemplateCommandErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;

  if (message.includes("chore_templates_due_time_order")) {
    return "Due window end must be after the start.";
  }

  if (message.includes("chore_templates_weekly_shape")) {
    return "Choose at least one weekday for weekly chores.";
  }

  if (message.includes("chore_templates_interval_shape")) {
    return "Enter an interval for every-few-days chores.";
  }

  if (message.includes("chore_templates_one_off_shape")) {
    return "Choose a chore date on or after the start date.";
  }

  if (message.includes("chore_templates_daily_shape")) {
    return "Daily chores should not include weekly, interval, or one-time schedule details.";
  }

  if (message.includes("chore_templates_fixed_amount") || message.includes("amount_cents")) {
    return "Enter an amount for fixed-value chores.";
  }

  if (message.includes("chore_templates_rotation_shape")) {
    return "Choose rotation cadence and children.";
  }

  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "You do not have permission to save chores for this household.";
  }

  return message;
}

export function orderRotationChildren(childProfileIds: string[], startChildProfileId?: string) {
  if (!startChildProfileId) {
    return childProfileIds;
  }

  return [
    startChildProfileId,
    ...childProfileIds.filter((childProfileId) => childProfileId !== startChildProfileId),
  ];
}
