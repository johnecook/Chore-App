import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { createSupabaseServiceRoleClient } from "./server";

export const CHORE_SUBMISSION_PHOTO_BUCKET = "chore-submission-photos";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
]);

type AppSupabaseClient = SupabaseClient<Database>;

export function chorePhotoValidationError(file: File) {
  if (file.size > MAX_PHOTO_BYTES) {
    return "Photo proof must be 5 MB or smaller.";
  }

  if (!PHOTO_EXTENSIONS.has(file.type)) {
    return "Photo proof must be a JPEG, PNG, WebP, HEIC, or HEIF image.";
  }

  return null;
}

export function chorePhotoStoragePath(profileId: string, instanceId: string, file: File) {
  const extension = PHOTO_EXTENSIONS.get(file.type) ?? "jpg";
  return `${profileId}/${instanceId}/${crypto.randomUUID()}.${extension}`;
}

export async function removeStoredChorePhotos(paths: Array<string | null | undefined>) {
  const uniquePaths = [...new Set(paths.filter((path): path is string => Boolean(path)))];

  if (!uniquePaths.length) {
    return;
  }

  try {
    const serviceRoleSupabase = createSupabaseServiceRoleClient();
    const { error } = await serviceRoleSupabase.storage
      .from(CHORE_SUBMISSION_PHOTO_BUCKET)
      .remove(uniquePaths);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error("Could not remove stored submission photos.", error);
  }
}

export function createPhotoCleanupLookupClient(fallbackClient: AppSupabaseClient) {
  try {
    return createSupabaseServiceRoleClient();
  } catch {
    return fallbackClient;
  }
}
