import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

type AppSupabaseClient = SupabaseClient<Database>;

async function unwrapRpcId(
  request: PromiseLike<{ data: string | null; error: { message: string } | null }>,
): Promise<string> {
  const { data, error } = await request;

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Expected command to return an id.");
  }

  return data;
}

export function claimChoreInstance(client: AppSupabaseClient, instanceId: string) {
  return unwrapRpcId(
    client.rpc("claim_chore_instance", {
      target_instance_id: instanceId,
    }),
  );
}

export function createChoreTemplate(
  client: AppSupabaseClient,
  params: {
    householdId: string;
    title: string;
    description?: string | null;
    scheduleType: Database["public"]["Enums"]["chore_schedule_type"];
    startDate: string;
    weeklyWeekdays?: number[] | null;
    intervalDays?: number | null;
    oneOffDate?: string | null;
    dueTimeStart?: string | null;
    dueTimeEnd?: string | null;
    assignmentMode: Database["public"]["Enums"]["chore_assignment_mode"];
    rotationCadence?: Database["public"]["Enums"]["chore_rotation_cadence"] | null;
    rotationChildScope?: Database["public"]["Enums"]["chore_rotation_child_scope"] | null;
    valueModel: Database["public"]["Enums"]["chore_value_model"];
    amountCents: number;
    photoRequired: boolean;
    approvalRequired: boolean;
    selectedChildProfileIds: string[];
    checklistItems?: string[];
  },
) {
  return unwrapRpcId(
    client.rpc("create_chore_template", {
      target_household_id: params.householdId,
      chore_title: params.title,
      chore_description: params.description ?? null,
      chore_schedule_type: params.scheduleType,
      chore_start_date: params.startDate,
      chore_weekly_weekdays: params.weeklyWeekdays ?? null,
      chore_interval_days: params.intervalDays ?? null,
      chore_one_off_date: params.oneOffDate ?? null,
      chore_due_time_start: params.dueTimeStart ?? null,
      chore_due_time_end: params.dueTimeEnd ?? null,
      chore_assignment_mode: params.assignmentMode,
      chore_value_model: params.valueModel,
      chore_amount_cents: params.amountCents,
      chore_photo_required: params.photoRequired,
      chore_approval_required: params.approvalRequired,
      selected_child_profile_ids: params.selectedChildProfileIds,
      chore_checklist_items: params.checklistItems ?? [],
      chore_rotation_cadence: params.rotationCadence ?? null,
      chore_rotation_child_scope: params.rotationChildScope ?? null,
    }),
  );
}

export async function deactivateChoreTemplate(
  client: AppSupabaseClient,
  params: {
    householdId: string;
    templateId: string;
  },
) {
  const { data, error } = await client
    .from("chore_templates")
    .update({ active: false })
    .eq("id", params.templateId)
    .eq("household_id", params.householdId)
    .eq("active", true)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("That chore template could not be found or is already inactive.");
  }

  return data.id;
}

export async function reactivateChoreTemplate(
  client: AppSupabaseClient,
  params: {
    householdId: string;
    templateId: string;
  },
) {
  const { data, error } = await client
    .from("chore_templates")
    .update({ active: true })
    .eq("id", params.templateId)
    .eq("household_id", params.householdId)
    .eq("active", false)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("That chore template could not be found or is already active.");
  }

  return data.id;
}

export async function updateChoreTemplateBasics(
  client: AppSupabaseClient,
  params: {
    householdId: string;
    templateId: string;
    title: string;
    description?: string | null;
    scheduleType: Database["public"]["Enums"]["chore_schedule_type"];
    startDate: string;
    weeklyWeekdays?: number[] | null;
    intervalDays?: number | null;
    oneOffDate?: string | null;
    dueTimeStart?: string | null;
    dueTimeEnd?: string | null;
    assignmentMode: Database["public"]["Enums"]["chore_assignment_mode"];
    rotationCadence?: Database["public"]["Enums"]["chore_rotation_cadence"] | null;
    rotationChildScope?: Database["public"]["Enums"]["chore_rotation_child_scope"] | null;
    valueModel: Database["public"]["Enums"]["chore_value_model"];
    amountCents: number;
    photoRequired: boolean;
    approvalRequired: boolean;
    selectedChildProfileIds: string[];
    checklistItems: string[];
  },
) {
  if (
    params.assignmentMode === "selected_children" ||
    (params.assignmentMode === "rotation" && params.rotationChildScope === "selected_children")
  ) {
    const { count, error: childCountError } = await client
      .from("child_profiles")
      .select("id", { count: "exact", head: true })
      .eq("primary_household_id", params.householdId)
      .in("id", params.selectedChildProfileIds);

    if (childCountError) {
      throw new Error(childCountError.message);
    }

    if (count !== params.selectedChildProfileIds.length) {
      throw new Error("Choose children from this household.");
    }
  }

  const { data, error } = await client
    .from("chore_templates")
    .update({
      title: params.title,
      description: params.description ?? null,
      schedule_type: params.scheduleType,
      start_date: params.startDate,
      weekly_weekdays: params.weeklyWeekdays ?? null,
      interval_days: params.intervalDays ?? null,
      one_off_date: params.oneOffDate ?? null,
      due_time_start: params.dueTimeStart ?? null,
      due_time_end: params.dueTimeEnd ?? null,
      assignment_mode: params.assignmentMode,
      rotation_cadence: params.assignmentMode === "rotation" ? params.rotationCadence : null,
      rotation_child_scope: params.assignmentMode === "rotation" ? params.rotationChildScope : null,
      rotation_anchor_date: params.assignmentMode === "rotation" ? params.startDate : null,
      value_model: params.valueModel,
      amount_cents: params.amountCents,
      photo_required: params.photoRequired,
      approval_required: params.approvalRequired,
    })
    .eq("id", params.templateId)
    .eq("household_id", params.householdId)
    .eq("active", true)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("That chore template could not be found or is inactive.");
  }

  const { error: deleteAssigneesError } = await client
    .from("chore_template_assignees")
    .delete()
    .eq("template_id", data.id);

  if (deleteAssigneesError) {
    throw new Error(deleteAssigneesError.message);
  }

  const { error: deleteChecklistError } = await client
    .from("chore_template_checklist_items")
    .delete()
    .eq("template_id", data.id);

  if (deleteChecklistError) {
    throw new Error(deleteChecklistError.message);
  }

  const checklistItems = params.checklistItems
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (checklistItems.length) {
    const { error: insertChecklistError } = await client
      .from("chore_template_checklist_items")
      .insert(
        checklistItems.map((label, index) => ({
          template_id: data.id,
          label,
          position: index + 1,
        })),
      );

    if (insertChecklistError) {
      throw new Error(insertChecklistError.message);
    }
  }

  if (
    params.assignmentMode === "selected_children" ||
    (params.assignmentMode === "rotation" && params.rotationChildScope === "selected_children")
  ) {
    const { error: insertAssigneesError } = await client.from("chore_template_assignees").insert(
      params.selectedChildProfileIds.map((childProfileId, index) => ({
        template_id: data.id,
        child_profile_id: childProfileId,
        position: index + 1,
      })),
    );

    if (insertAssigneesError) {
      throw new Error(insertAssigneesError.message);
    }
  }

  return data.id;
}

export function submitChoreInstance(
  client: AppSupabaseClient,
  params: {
    instanceId: string;
    note?: string | null;
    photoStoragePath?: string | null;
    autoApprovePayPeriodId?: string | null;
    submittedOn?: string;
    checkedChecklistItemIds?: string[];
  },
) {
  return unwrapRpcId(
    client.rpc("submit_chore_instance", {
      target_instance_id: params.instanceId,
      submission_note: params.note ?? null,
      submission_photo_storage_path: params.photoStoragePath ?? null,
      auto_approve_pay_period_id: params.autoApprovePayPeriodId ?? null,
      submitted_on: params.submittedOn,
      checked_checklist_item_ids: params.checkedChecklistItemIds ?? [],
    }),
  );
}

export function approveChoreSubmission(
  client: AppSupabaseClient,
	  params: {
	    submissionId: string;
	    payPeriodId?: string | null;
	    approvedOn?: string;
	    feedback?: string | null;
	  },
) {
  return unwrapRpcId(
    client.rpc("approve_chore_submission", {
	      target_submission_id: params.submissionId,
	      target_pay_period_id: params.payPeriodId ?? null,
      approved_on: params.approvedOn,
      approval_feedback: params.feedback ?? null,
    }),
  );
}

export function approveChoreSubmissionForCurrentPeriod(
  client: AppSupabaseClient,
  params: {
    submissionId: string;
    approvedOn?: string;
    feedback?: string | null;
  },
) {
  return unwrapRpcId(
    client.rpc("approve_chore_submission_for_current_period", {
      target_submission_id: params.submissionId,
      approved_on: params.approvedOn,
      approval_feedback: params.feedback ?? null,
    }),
  );
}

export function rejectChoreSubmission(
  client: AppSupabaseClient,
  params: {
    submissionId: string;
    feedback: string;
  },
) {
  return unwrapRpcId(
    client.rpc("reject_chore_submission", {
      target_submission_id: params.submissionId,
      rejection_feedback: params.feedback,
    }),
  );
}

export function reopenChoreInstance(
  client: AppSupabaseClient,
  params: {
    instanceId: string;
    feedback?: string | null;
  },
) {
  return unwrapRpcId(
    client.rpc("reopen_chore_instance", {
      target_instance_id: params.instanceId,
      reopen_feedback: params.feedback ?? null,
    }),
  );
}

export async function deleteSubmissionPhoto(client: AppSupabaseClient, submissionId: string) {
  const { error } = await client.rpc("delete_submission_photo", {
    target_submission_id: submissionId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function closeOutPayout(
  client: AppSupabaseClient,
  params: {
    payPeriodId: string;
    childProfileId: string;
    note?: string | null;
  },
) {
  return unwrapRpcId(
    client.rpc("close_out_payout", {
      target_pay_period_id: params.payPeriodId,
      target_child_profile_id: params.childProfileId,
      payout_note: params.note ?? null,
    }),
  );
}

export function createManualAdjustment(
  client: AppSupabaseClient,
  params: {
    childProfileId: string;
    amountCents: number;
    description: string;
    effectiveOn?: string;
    payPeriodId?: string | null;
  },
) {
  return unwrapRpcId(
    client.rpc("create_manual_adjustment", {
      target_child_profile_id: params.childProfileId,
      target_amount_cents: params.amountCents,
      adjustment_description: params.description,
      effective_on: params.effectiveOn,
      target_pay_period_id: params.payPeriodId ?? null,
    }),
  );
}
