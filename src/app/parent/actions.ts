"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  approveChoreSubmissionForCurrentPeriod,
  closeOutPayout,
  deleteSubmissionPhoto,
  rejectChoreSubmission,
} from "@/lib/supabase/chore-commands";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const approveSubmissionSchema = z.object({
  submissionId: z.uuid(),
  feedback: z.string().trim().max(500).optional(),
});

const rejectSubmissionSchema = z.object({
  submissionId: z.uuid(),
  feedback: z.string().trim().min(1).max(500),
});

const closeOutPayoutSchema = z.object({
  childProfileId: z.uuid(),
  payPeriodId: z.uuid(),
  note: z.string().trim().max(500).optional(),
});

const deleteSubmissionPhotoSchema = z.object({
  submissionId: z.uuid(),
});

function parentDashboardError(message: string): never {
  redirect(`/parent?error=${encodeURIComponent(message)}`);
}

function optionalString(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();
  return stringValue.length ? stringValue : undefined;
}

export async function approveSubmissionAction(formData: FormData) {
  const parsed = approveSubmissionSchema.safeParse({
    submissionId: formData.get("submissionId"),
    feedback: optionalString(formData.get("feedback")),
  });

  if (!parsed.success) {
    parentDashboardError("That submission could not be approved.");
  }

  const supabase = await createSupabaseServerClient();
  let approvalId: string;

  try {
    approvalId = await approveChoreSubmissionForCurrentPeriod(supabase, {
      submissionId: parsed.data.submissionId,
      feedback: parsed.data.feedback ?? null,
    });
  } catch (error) {
    parentDashboardError(error instanceof Error ? error.message : "Could not approve chore.");
  }

  redirect(`/parent?approved=${approvalId}`);
}

export async function rejectSubmissionAction(formData: FormData) {
  const parsed = rejectSubmissionSchema.safeParse({
    submissionId: formData.get("submissionId"),
    feedback: optionalString(formData.get("feedback")),
  });

  if (!parsed.success) {
    parentDashboardError("Add feedback before sending a chore back.");
  }

  const supabase = await createSupabaseServerClient();
  let rejectionId: string;

  try {
    rejectionId = await rejectChoreSubmission(supabase, {
      submissionId: parsed.data.submissionId,
      feedback: parsed.data.feedback,
    });
  } catch (error) {
    parentDashboardError(error instanceof Error ? error.message : "Could not send chore back.");
  }

  redirect(`/parent?rejected=${rejectionId}`);
}

export async function closeOutPayoutAction(formData: FormData) {
  const parsed = closeOutPayoutSchema.safeParse({
    childProfileId: formData.get("childProfileId"),
    payPeriodId: formData.get("payPeriodId"),
    note: optionalString(formData.get("note")),
  });

  if (!parsed.success) {
    parentDashboardError("That payout could not be closed out.");
  }

  const supabase = await createSupabaseServerClient();
  let payoutId: string;

  try {
    payoutId = await closeOutPayout(supabase, {
      payPeriodId: parsed.data.payPeriodId,
      childProfileId: parsed.data.childProfileId,
      note: parsed.data.note ?? null,
    });
  } catch (error) {
    parentDashboardError(error instanceof Error ? error.message : "Could not close out payout.");
  }

  redirect(`/parent?paid=${payoutId}`);
}

export async function deleteSubmissionPhotoAction(formData: FormData) {
  const parsed = deleteSubmissionPhotoSchema.safeParse({
    submissionId: formData.get("submissionId"),
  });

  if (!parsed.success) {
    parentDashboardError("That photo could not be removed.");
  }

  const supabase = await createSupabaseServerClient();

  try {
    await deleteSubmissionPhoto(supabase, parsed.data.submissionId);
  } catch (error) {
    parentDashboardError(error instanceof Error ? error.message : "Could not remove photo.");
  }

  redirect("/parent?photoDeleted=1");
}
