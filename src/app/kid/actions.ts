"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { claimChoreInstance, submitChoreInstance } from "@/lib/supabase/chore-commands";
import { requireCurrentProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PHOTO_BUCKET = "chore-submission-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
]);

const instanceSchema = z.object({
  instanceId: z.uuid(),
});

const submitChoreSchema = instanceSchema.extend({
  note: z.string().trim().max(500).optional(),
});

function kidError(message: string): never {
  redirect(`/kid?error=${encodeURIComponent(message)}`);
}

function optionalString(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();
  return stringValue.length ? stringValue : undefined;
}

function optionalFile(value: FormDataEntryValue | null) {
  return value instanceof File && value.size > 0 ? value : undefined;
}

function photoValidationError(file: File) {
  if (file.size > MAX_PHOTO_BYTES) {
    return "Photo proof must be 5 MB or smaller.";
  }

  if (!PHOTO_EXTENSIONS.has(file.type)) {
    return "Photo proof must be a JPEG, PNG, WebP, HEIC, or HEIF image.";
  }

  return null;
}

function photoStoragePath(profileId: string, instanceId: string, file: File) {
  const extension = PHOTO_EXTENSIONS.get(file.type) ?? "jpg";
  return `${profileId}/${instanceId}/${crypto.randomUUID()}.${extension}`;
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
  const photo = optionalFile(formData.get("photo"));
  const parsed = submitChoreSchema.safeParse({
    instanceId: formData.get("instanceId"),
    note: optionalString(formData.get("note")),
  });

  if (!parsed.success) {
    kidError("Check the submission and try again.");
  }

  const validationError = photo ? photoValidationError(photo) : null;

  if (validationError) {
    kidError(validationError);
  }

  const profile = await requireCurrentProfile();
  const supabase = await createSupabaseServerClient();
  const { data: childProfile, error: childProfileError } = await supabase
    .from("child_profiles")
    .select("id")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (childProfileError) {
    throw new Error(childProfileError.message);
  }

  if (!childProfile) {
    kidError("Child profile is required to submit chores.");
  }

  const { data: instance, error: instanceError } = await supabase
    .from("chore_instances")
    .select("assigned_child_profile_id, photo_required_snapshot, status")
    .eq("id", parsed.data.instanceId)
    .maybeSingle();

  if (instanceError) {
    throw new Error(instanceError.message);
  }

  if (!instance || instance.assigned_child_profile_id !== childProfile.id) {
    kidError("That chore is not assigned to this child.");
  }

  if (instance.status !== "assigned" && instance.status !== "rejected") {
    kidError("That chore is not ready to submit.");
  }

  if (instance.photo_required_snapshot && !photo) {
    kidError("Add photo proof before submitting this chore.");
  }

  let uploadedPhotoPath: string | null = null;

  if (photo) {
    uploadedPhotoPath = photoStoragePath(profile.id, parsed.data.instanceId, photo);
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(uploadedPhotoPath, photo, {
        contentType: photo.type,
        upsert: false,
      });

    if (uploadError) {
      kidError(uploadError.message);
    }
  }

  let submissionId: string;

  try {
    submissionId = await submitChoreInstance(supabase, {
      instanceId: parsed.data.instanceId,
      note: parsed.data.note ?? null,
      photoStoragePath: uploadedPhotoPath,
    });
  } catch (error) {
    kidError(error instanceof Error ? error.message : "Could not submit chore.");
  }

  redirect(`/kid?submitted=${submissionId}`);
}
