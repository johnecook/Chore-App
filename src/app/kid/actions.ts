"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { claimChoreInstance, submitChoreInstance } from "@/lib/supabase/chore-commands";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const instanceSchema = z.object({
  instanceId: z.uuid(),
});

const submitChoreSchema = instanceSchema.extend({
  note: z.string().trim().max(500).optional(),
  photoStoragePath: z.string().trim().max(240).optional(),
});

function kidError(message: string): never {
  redirect(`/kid?error=${encodeURIComponent(message)}`);
}

function optionalString(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();
  return stringValue.length ? stringValue : undefined;
}

export async function claimChoreAction(formData: FormData) {
  const parsed = instanceSchema.safeParse({
    instanceId: formData.get("instanceId"),
  });

  if (!parsed.success) {
    kidError("That chore could not be claimed.");
  }

  const supabase = await createSupabaseServerClient();
  let claimId: string;

  try {
    claimId = await claimChoreInstance(supabase, parsed.data.instanceId);
  } catch (error) {
    kidError(error instanceof Error ? error.message : "Could not claim chore.");
  }

  redirect(`/kid?claimed=${claimId}`);
}

export async function submitChoreAction(formData: FormData) {
  const parsed = submitChoreSchema.safeParse({
    instanceId: formData.get("instanceId"),
    note: optionalString(formData.get("note")),
    photoStoragePath: optionalString(formData.get("photoStoragePath")),
  });

  if (!parsed.success) {
    kidError("Check the submission and try again.");
  }

  const supabase = await createSupabaseServerClient();
  let submissionId: string;

  try {
    submissionId = await submitChoreInstance(supabase, {
      instanceId: parsed.data.instanceId,
      note: parsed.data.note ?? null,
      photoStoragePath: parsed.data.photoStoragePath ?? null,
    });
  } catch (error) {
    kidError(error instanceof Error ? error.message : "Could not submit chore.");
  }

  redirect(`/kid?submitted=${submissionId}`);
}
