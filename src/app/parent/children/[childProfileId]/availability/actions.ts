"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentParentHouseholdId } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const availabilityWindowSchema = z.object({
  childProfileId: z.uuid(),
  anchorDate: z.iso.date(),
  pattern: z.enum(["every_day", "week_on_week_off", "custom"]),
  cycleLengthDays: z.coerce.number().int().min(1).max(60),
  availableDayOffsets: z.array(z.coerce.number().int().min(0).max(59)).min(1),
});

const availabilityOverrideSchema = z.object({
  childProfileId: z.uuid(),
  overrideDate: z.iso.date(),
  available: z.enum(["true", "false"]).transform((value) => value === "true"),
  reason: z.string().trim().max(120).optional(),
});

const deleteOverrideSchema = z.object({
  childProfileId: z.uuid(),
  overrideId: z.uuid(),
});

function safeReturnPath(rawReturnTo: FormDataEntryValue | null) {
  const returnTo = rawReturnTo?.toString();

  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return null;
  }

  return returnTo;
}

function safeReturnLabel(rawReturnLabel: FormDataEntryValue | null) {
  const returnLabel = rawReturnLabel?.toString().trim();

  if (!returnLabel) {
    return null;
  }

  return returnLabel.slice(0, 80);
}

function availabilityRedirectPath(
  childProfileId: string,
  params: { error?: string; returnLabel?: string | null; returnTo?: string | null; saved?: string },
) {
  const searchParams = new URLSearchParams();

  if (params.error) {
    searchParams.set("error", params.error);
  }

  if (params.saved) {
    searchParams.set("saved", params.saved);
  }

  if (params.returnTo) {
    searchParams.set("returnTo", params.returnTo);
  }

  if (params.returnLabel) {
    searchParams.set("returnLabel", params.returnLabel);
  }

  return `/parent/children/${childProfileId}/availability?${searchParams.toString()}`;
}

function availabilityError(childProfileId: string, message: string, formData?: FormData): never {
  redirect(
    availabilityRedirectPath(childProfileId, {
      error: message,
      returnLabel: formData ? safeReturnLabel(formData.get("returnLabel")) : null,
      returnTo: formData ? safeReturnPath(formData.get("returnTo")) : null,
    }),
  );
}

function offsetsForPattern(formData: FormData): number[] {
  const pattern = formData.get("pattern");

  if (pattern === "every_day") {
    return [0];
  }

  if (pattern === "week_on_week_off") {
    return [0, 1, 2, 3, 4, 5, 6];
  }

  return formData
    .getAll("availableDayOffsets")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));
}

export async function saveAvailabilityWindowAction(formData: FormData) {
  const childProfileId = String(formData.get("childProfileId") ?? "");
  const pattern = formData.get("pattern");
  const parsed = availabilityWindowSchema.safeParse({
    childProfileId,
    anchorDate: formData.get("anchorDate"),
    pattern,
    cycleLengthDays:
      pattern === "every_day" ? 1 : pattern === "week_on_week_off" ? 14 : formData.get("cycleLengthDays"),
    availableDayOffsets: offsetsForPattern(formData),
  });

  if (!parsed.success) {
    availabilityError(childProfileId, "Choose a valid custody pattern.", formData);
  }

  const householdId = await requireCurrentParentHouseholdId();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("upsert_child_availability_window", {
    target_child_profile_id: parsed.data.childProfileId,
    target_household_id: householdId,
    target_anchor_date: parsed.data.anchorDate,
    target_cycle_length_days: parsed.data.cycleLengthDays,
    target_available_day_offsets: parsed.data.availableDayOffsets,
    target_starts_on: parsed.data.anchorDate,
    target_ends_on: null,
  });

  if (error) {
    availabilityError(parsed.data.childProfileId, error.message, formData);
  }

  redirect(
    availabilityRedirectPath(parsed.data.childProfileId, {
      returnLabel: safeReturnLabel(formData.get("returnLabel")),
      returnTo: safeReturnPath(formData.get("returnTo")),
      saved: "pattern",
    }),
  );
}

export async function saveAvailabilityOverrideAction(formData: FormData) {
  const childProfileId = String(formData.get("childProfileId") ?? "");
  const parsed = availabilityOverrideSchema.safeParse({
    childProfileId,
    overrideDate: formData.get("overrideDate"),
    available: formData.get("available"),
    reason: formData.get("reason") || undefined,
  });

  if (!parsed.success) {
    availabilityError(childProfileId, "Enter a valid override date.", formData);
  }

  const householdId = await requireCurrentParentHouseholdId();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("upsert_child_availability_override", {
    target_child_profile_id: parsed.data.childProfileId,
    target_household_id: householdId,
    target_override_date: parsed.data.overrideDate,
    target_available: parsed.data.available,
    target_reason: parsed.data.reason ?? null,
  });

  if (error) {
    availabilityError(parsed.data.childProfileId, error.message, formData);
  }

  redirect(
    availabilityRedirectPath(parsed.data.childProfileId, {
      returnLabel: safeReturnLabel(formData.get("returnLabel")),
      returnTo: safeReturnPath(formData.get("returnTo")),
      saved: "override",
    }),
  );
}

export async function deleteAvailabilityOverrideAction(formData: FormData) {
  const childProfileId = String(formData.get("childProfileId") ?? "");
  const parsed = deleteOverrideSchema.safeParse({
    childProfileId,
    overrideId: formData.get("overrideId"),
  });

  if (!parsed.success) {
    availabilityError(childProfileId, "That override could not be deleted.", formData);
  }

  await requireCurrentParentHouseholdId();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_child_availability_override", {
    target_override_id: parsed.data.overrideId,
  });

  if (error) {
    availabilityError(parsed.data.childProfileId, error.message, formData);
  }

  redirect(
    availabilityRedirectPath(parsed.data.childProfileId, {
      returnLabel: safeReturnLabel(formData.get("returnLabel")),
      returnTo: safeReturnPath(formData.get("returnTo")),
      saved: "deleted",
    }),
  );
}
