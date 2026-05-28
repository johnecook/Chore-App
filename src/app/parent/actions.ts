"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  approveChoreSubmissionForCurrentPeriod,
  closeOutPayout,
  createManualAdjustment,
  deactivateChoreTemplate,
  deleteSubmissionPhoto,
  rejectChoreSubmission,
  reopenChoreInstance,
} from "@/lib/supabase/chore-commands";
import {
  createPhotoCleanupLookupClient,
  removeStoredChorePhotos,
} from "@/lib/supabase/chore-photo-storage";
import { getCurrentParentHouseholdId } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const approveSubmissionSchema = z.object({
  submissionId: z.uuid(),
  feedback: z.string().trim().max(500).optional(),
});

const rejectSubmissionSchema = z.object({
  submissionId: z.uuid(),
  feedback: z.string().trim().min(1).max(500),
});

const reopenChoreSchema = z.object({
  instanceId: z.uuid(),
  feedback: z.string().trim().max(500).optional(),
});

const closeOutPayoutSchema = z.object({
  childProfileId: z.uuid(),
  payPeriodId: z.uuid(),
  note: z.string().trim().max(500).optional(),
  redirectTo: z.enum(["dashboard", "money"]).optional(),
});

const deleteSubmissionPhotoSchema = z.object({
  submissionId: z.uuid(),
});

const deactivateTemplateSchema = z.object({
  templateId: z.uuid(),
  redirectTo: z.enum(["dashboard", "chores"]).optional(),
});

const manualAdjustmentSchema = z.object({
  childProfileId: z.uuid(),
  direction: z.enum(["credit", "debit"]),
  amountDollars: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  description: z.string().trim().min(1).max(500),
  effectiveOn: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  payPeriodId: z.uuid().optional(),
  redirectTo: z.enum(["dashboard", "money"]).optional(),
});

function parentDashboardError(message: string): never {
  redirect(`/parent?error=${encodeURIComponent(message)}`);
}

function optionalString(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();
  return stringValue.length ? stringValue : undefined;
}

function dollarsToCents(value: string) {
  const [dollars, cents = ""] = value.split(".");
  return Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
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

export async function reopenChoreAction(formData: FormData) {
  const parsed = reopenChoreSchema.safeParse({
    instanceId: formData.get("instanceId"),
    feedback: optionalString(formData.get("feedback")),
  });

  if (!parsed.success) {
    parentDashboardError("That chore could not be reopened.");
  }

  const supabase = await createSupabaseServerClient();
  let reopenId: string;

  try {
    reopenId = await reopenChoreInstance(supabase, {
      instanceId: parsed.data.instanceId,
      feedback: parsed.data.feedback ?? null,
    });
  } catch (error) {
    parentDashboardError(error instanceof Error ? error.message : "Could not reopen chore.");
  }

  redirect(`/parent?reopened=${reopenId}`);
}

export async function closeOutPayoutAction(formData: FormData) {
  const parsed = closeOutPayoutSchema.safeParse({
    childProfileId: formData.get("childProfileId"),
    payPeriodId: formData.get("payPeriodId"),
    note: optionalString(formData.get("note")),
    redirectTo: optionalString(formData.get("redirectTo")),
  });

  if (!parsed.success) {
    parentDashboardError("That payout could not be closed out.");
  }

  const supabase = await createSupabaseServerClient();
  const photoLookupSupabase = createPhotoCleanupLookupClient(supabase);
  const { data: approvedLedgerRows, error: ledgerError } = await photoLookupSupabase
    .from("ledger_transactions")
    .select("chore_instance_id")
    .eq("pay_period_id", parsed.data.payPeriodId)
    .eq("child_profile_id", parsed.data.childProfileId)
    .eq("transaction_type", "approved_credit");

  if (ledgerError) {
    throw new Error(ledgerError.message);
  }

  const approvedInstanceIds = [
    ...new Set(
      approvedLedgerRows
        ?.map((row) => row.chore_instance_id)
        .filter((instanceId): instanceId is string => Boolean(instanceId)) ?? [],
    ),
  ];
  const { data: photoSubmissions, error: photoSubmissionError } = approvedInstanceIds.length
    ? await photoLookupSupabase
        .from("chore_submissions")
        .select("photo_storage_path")
        .in("instance_id", approvedInstanceIds)
        .is("photo_deleted_at", null)
        .not("photo_storage_path", "is", null)
    : { data: [], error: null };

  if (photoSubmissionError) {
    throw new Error(photoSubmissionError.message);
  }

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

  await removeStoredChorePhotos(
    photoSubmissions?.map((submission) => submission.photo_storage_path) ?? [],
  );

  const destination = parsed.data.redirectTo === "money" ? "/parent/money" : "/parent";
  redirect(`${destination}?paid=${payoutId}`);
}

export async function deleteSubmissionPhotoAction(formData: FormData) {
  const parsed = deleteSubmissionPhotoSchema.safeParse({
    submissionId: formData.get("submissionId"),
  });

  if (!parsed.success) {
    parentDashboardError("That photo could not be removed.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: submission, error: submissionError } = await supabase
    .from("chore_submissions")
    .select("photo_storage_path")
    .eq("id", parsed.data.submissionId)
    .maybeSingle();

  if (submissionError) {
    throw new Error(submissionError.message);
  }

  try {
    await deleteSubmissionPhoto(supabase, parsed.data.submissionId);
  } catch (error) {
    parentDashboardError(error instanceof Error ? error.message : "Could not remove photo.");
  }

  await removeStoredChorePhotos([submission?.photo_storage_path]);

  redirect("/parent?photoDeleted=1");
}

export async function deactivateTemplateAction(formData: FormData) {
  const parsed = deactivateTemplateSchema.safeParse({
    templateId: formData.get("templateId"),
    redirectTo: optionalString(formData.get("redirectTo")),
  });

  if (!parsed.success) {
    parentDashboardError("That chore template could not be deactivated.");
  }

  const householdId = await getCurrentParentHouseholdId();

  if (!householdId) {
    parentDashboardError("Choose a household before changing chore templates.");
  }

  const supabase = await createSupabaseServerClient();
  let templateId: string;

  try {
    templateId = await deactivateChoreTemplate(supabase, {
      householdId,
      templateId: parsed.data.templateId,
    });
  } catch (error) {
    parentDashboardError(error instanceof Error ? error.message : "Could not deactivate template.");
  }

  const destination = parsed.data.redirectTo === "chores" ? "/parent/chores" : "/parent";
  redirect(`${destination}?deactivatedTemplate=${templateId}`);
}

export async function createManualAdjustmentAction(formData: FormData) {
  const parsed = manualAdjustmentSchema.safeParse({
    childProfileId: formData.get("childProfileId"),
    direction: formData.get("direction"),
    amountDollars: formData.get("amountDollars"),
    description: formData.get("description"),
    effectiveOn: optionalString(formData.get("effectiveOn")),
    payPeriodId: optionalString(formData.get("payPeriodId")),
    redirectTo: optionalString(formData.get("redirectTo")),
  });

  if (!parsed.success) {
    parentDashboardError("Enter a child, amount, and note for the adjustment.");
  }

  const unsignedCents = dollarsToCents(parsed.data.amountDollars);

  if (unsignedCents <= 0) {
    parentDashboardError("Adjustment amount must be greater than zero.");
  }

  const amountCents = parsed.data.direction === "credit" ? unsignedCents : -unsignedCents;
  const supabase = await createSupabaseServerClient();
  let adjustmentId: string;

  try {
    adjustmentId = await createManualAdjustment(supabase, {
      childProfileId: parsed.data.childProfileId,
      amountCents,
      description: parsed.data.description,
      effectiveOn: parsed.data.effectiveOn,
      payPeriodId: parsed.data.payPeriodId ?? null,
    });
  } catch (error) {
    parentDashboardError(error instanceof Error ? error.message : "Could not add adjustment.");
  }

  const destination = parsed.data.redirectTo === "money" ? "/parent/money" : "/parent";
  redirect(`${destination}?adjusted=${adjustmentId}`);
}

export async function syncScheduleAction() {
  const householdId = await getCurrentParentHouseholdId();

  if (!householdId) {
    parentDashboardError("Choose a household before syncing chores.");
  }

  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createSupabaseServerClient();
  const { error: generationError } = await supabase.rpc("generate_chore_instances_for_range", {
    range_start: today,
    range_end: addDays(today, 1),
  });

  if (generationError) {
    parentDashboardError(generationError.message);
  }

  const { error: expirationError } = await supabase.rpc("expire_overdue_chore_instances", {});

  if (expirationError) {
    parentDashboardError(expirationError.message);
  }

  redirect("/parent?synced=1");
}
