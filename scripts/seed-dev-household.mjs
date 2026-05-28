import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const projectRoot = resolve(import.meta.dirname, "..");
const seedPassword = process.env.DEV_SEED_PASSWORD ?? "CookFamily123!";
const householdName = "Cook Household";

const accounts = {
  parent: {
    appRole: "parent",
    displayName: "John",
    email: "john.cook@example.test",
  },
  will: {
    appRole: "child",
    displayName: "Will",
    email: "will.cook@example.test",
  },
  hollis: {
    appRole: "child",
    displayName: "Hollis",
    email: "hollis.cook@example.test",
  },
};

async function loadEnvFile(path) {
  try {
    const contents = await readFile(path, "utf8");
    for (const line of contents.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      process.env[key] ??= value.replace(/^["']|["']$/g, "");
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function loadEnv() {
  await loadEnvFile(resolve(projectRoot, ".env.local"));
  await loadEnvFile(resolve(projectRoot, ".env"));
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required. Check .env.local or export it before running the seed.`);
  }

  return value;
}

function addDays(date, days) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function dueWindow(date, time) {
  return new Date(`${date}T${time}:00-05:00`).toISOString();
}

function withoutNullish(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== null && value !== undefined),
  );
}

async function listAllUsers(supabase) {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw error;
    }

    users.push(...data.users);

    if (data.users.length < 100) {
      return users;
    }

    page += 1;
  }
}

async function ensureAuthUser(supabase, account) {
  const existing = (await listAllUsers(supabase)).find(
    (user) => user.email?.toLowerCase() === account.email.toLowerCase(),
  );

  const attributes = {
    email: account.email,
    password: seedPassword,
    email_confirm: true,
    user_metadata: {
      app_role: account.appRole,
      display_name: account.displayName,
    },
  };

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, attributes);

    if (error) {
      throw error;
    }

    await upsertProfile(supabase, data.user.id, account);
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser(attributes);

  if (error) {
    throw error;
  }

  await upsertProfile(supabase, data.user.id, account);
  return data.user;
}

async function upsertProfile(supabase, userId, account) {
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    app_role: account.appRole,
    display_name: account.displayName,
  });

  if (error) {
    throw error;
  }
}

async function insertOne(supabase, table, row) {
  const { data, error } = await supabase.from(table).insert(row).select("id").single();

  if (error) {
    throw error;
  }

  return data.id;
}

async function createTemplate(supabase, params) {
  const templateId = await insertOne(supabase, "chore_templates", {
    household_id: params.householdId,
    created_by: params.createdBy,
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
    value_model: params.valueModel,
    amount_cents: params.amountCents,
    photo_required: params.photoRequired,
    approval_required: params.approvalRequired,
  });

  if (params.assigneeIds?.length) {
    const { error } = await supabase.from("chore_template_assignees").insert(
      params.assigneeIds.map((childProfileId) => ({
        template_id: templateId,
        child_profile_id: childProfileId,
      })),
    );

    if (error) {
      throw error;
    }
  }

  return templateId;
}

async function createInstance(supabase, params) {
  return insertOne(
    supabase,
    "chore_instances",
    withoutNullish({
      template_id: params.templateId,
      earning_household_id: params.householdId,
      assigned_child_profile_id: params.childProfileId ?? null,
      occurrence_date: params.occurrenceDate,
      due_window_start: params.dueWindowStart ?? null,
      due_window_end: params.dueWindowEnd ?? null,
      value_model_snapshot: params.valueModel,
      amount_cents_snapshot: params.amountCents,
      photo_required_snapshot: params.photoRequired,
      approval_required_snapshot: params.approvalRequired,
      status: params.status,
      up_for_grabs_slot: params.upForGrabs ?? false,
    }),
  );
}

async function createSubmission(supabase, params) {
  return insertOne(supabase, "chore_submissions", {
    instance_id: params.instanceId,
    child_profile_id: params.childProfileId,
    submitted_by: params.submittedBy,
    attempt_number: params.attemptNumber ?? 1,
    note: params.note,
  });
}

async function transitionInstanceStatus(supabase, instanceId, status) {
  const { error } = await supabase
    .from("chore_instances")
    .update({ status })
    .eq("id", instanceId);

  if (error) {
    throw error;
  }
}

async function main() {
  await loadEnv();

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const parentUser = await ensureAuthUser(supabase, accounts.parent);
  const willUser = await ensureAuthUser(supabase, accounts.will);
  const hollisUser = await ensureAuthUser(supabase, accounts.hollis);

  const { data: existingHousehold, error: existingHouseholdError } = await supabase
    .from("households")
    .select("id")
    .eq("name", householdName)
    .limit(1)
    .maybeSingle();

  if (existingHouseholdError) {
    throw existingHouseholdError;
  }

  if (existingHousehold) {
    console.log("Cook Household dev data already exists.");
    console.log("Credentials were refreshed. Reset Supabase before rerunning if you want a full rebuild.");
    console.log("");
    console.log("Login credentials:");
    console.log(`  Parent: ${accounts.parent.email} / ${seedPassword}`);
    console.log(`  Will:   ${accounts.will.email} / ${seedPassword}`);
    console.log(`  Hollis: ${accounts.hollis.email} / ${seedPassword}`);
    return;
  }

  const householdId = await insertOne(supabase, "households", {
    name: householdName,
    timezone: "America/Chicago",
    money_features_enabled: true,
    created_by: parentUser.id,
  });

  const { error: membershipError } = await supabase.from("household_memberships").insert([
    {
      household_id: householdId,
      user_id: parentUser.id,
      role: "admin",
      is_primary_payout_parent: true,
    },
    {
      household_id: householdId,
      user_id: willUser.id,
      role: "child",
      is_primary_payout_parent: false,
    },
    {
      household_id: householdId,
      user_id: hollisUser.id,
      role: "child",
      is_primary_payout_parent: false,
    },
  ]);

  if (membershipError) {
    throw membershipError;
  }

  const willChildProfileId = await insertOne(supabase, "child_profiles", {
    user_id: willUser.id,
    primary_household_id: householdId,
    created_by: parentUser.id,
  });

  const hollisChildProfileId = await insertOne(supabase, "child_profiles", {
    user_id: hollisUser.id,
    primary_household_id: householdId,
    created_by: parentUser.id,
  });

  const { error: payCycleError } = await supabase.from("pay_cycle_settings").insert({
    household_id: householdId,
    cycle_type: "weekly",
    weekly_weekday: 5,
    created_by: parentUser.id,
  });

  if (payCycleError) {
    throw payCycleError;
  }

  const { error: availabilityError } = await supabase.from("child_household_availability_windows").insert([
    {
      child_profile_id: willChildProfileId,
      child_user_id: willUser.id,
      household_id: householdId,
      anchor_date: "2026-05-25",
      cycle_length_days: 7,
      available_day_offsets: [0, 1, 2, 3, 4, 5, 6],
      created_by: parentUser.id,
    },
    {
      child_profile_id: hollisChildProfileId,
      child_user_id: hollisUser.id,
      household_id: householdId,
      anchor_date: "2026-05-25",
      cycle_length_days: 7,
      available_day_offsets: [0, 1, 2, 3, 4, 5, 6],
      created_by: parentUser.id,
    },
  ]);

  if (availabilityError) {
    throw availabilityError;
  }

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(today, 7);

  const kitchenTemplateId = await createTemplate(supabase, {
    householdId,
    createdBy: parentUser.id,
    title: "Kitchen reset",
    description: "Clear dishes, wipe counters, and start the dishwasher.",
    scheduleType: "daily",
    startDate: today,
    assignmentMode: "selected_children",
    valueModel: "fixed",
    amountCents: 250,
    photoRequired: false,
    approvalRequired: true,
    dueTimeEnd: "20:00",
    assigneeIds: [willChildProfileId, hollisChildProfileId],
  });

  const trashTemplateId = await createTemplate(supabase, {
    householdId,
    createdBy: parentUser.id,
    title: "Take out trash",
    description: "Take kitchen trash to the outside bin.",
    scheduleType: "weekly",
    startDate: today,
    weeklyWeekdays: [new Date(`${today}T00:00:00.000Z`).getUTCDay()],
    assignmentMode: "up_for_grabs",
    valueModel: "fixed",
    amountCents: 150,
    photoRequired: false,
    approvalRequired: true,
  });

  const bathroomTemplateId = await createTemplate(supabase, {
    householdId,
    createdBy: parentUser.id,
    title: "Bathroom counter",
    description: "Wipe sink, faucet, and mirror.",
    scheduleType: "one_off",
    startDate: today,
    oneOffDate: today,
    assignmentMode: "selected_children",
    valueModel: "unpaid",
    amountCents: 0,
    photoRequired: true,
    approvalRequired: true,
    assigneeIds: [willChildProfileId],
  });

  const bedTemplateId = await createTemplate(supabase, {
    householdId,
    createdBy: parentUser.id,
    title: "Make bed",
    description: "Make the bed and reset the room before school.",
    scheduleType: "daily",
    startDate: today,
    assignmentMode: "selected_children",
    valueModel: "allowance_included",
    amountCents: 0,
    photoRequired: false,
    approvalRequired: true,
    assigneeIds: [hollisChildProfileId],
  });

  const approvedTemplateId = await createTemplate(supabase, {
    householdId,
    createdBy: parentUser.id,
    title: "Fold towels",
    description: "Fold and put away bathroom towels.",
    scheduleType: "one_off",
    startDate: today,
    oneOffDate: today,
    assignmentMode: "selected_children",
    valueModel: "fixed",
    amountCents: 300,
    photoRequired: false,
    approvalRequired: true,
    assigneeIds: [willChildProfileId],
  });

  await createInstance(supabase, {
    templateId: kitchenTemplateId,
    householdId,
    childProfileId: willChildProfileId,
    occurrenceDate: today,
    dueWindowEnd: dueWindow(today, "20:00"),
    valueModel: "fixed",
    amountCents: 250,
    photoRequired: false,
    approvalRequired: true,
    status: "assigned",
  });

  await createInstance(supabase, {
    templateId: kitchenTemplateId,
    householdId,
    childProfileId: hollisChildProfileId,
    occurrenceDate: tomorrow,
    dueWindowEnd: dueWindow(tomorrow, "20:00"),
    valueModel: "fixed",
    amountCents: 250,
    photoRequired: false,
    approvalRequired: true,
    status: "assigned",
  });

  await createInstance(supabase, {
    templateId: kitchenTemplateId,
    householdId,
    childProfileId: willChildProfileId,
    occurrenceDate: nextWeek,
    dueWindowEnd: dueWindow(nextWeek, "20:00"),
    valueModel: "fixed",
    amountCents: 250,
    photoRequired: false,
    approvalRequired: true,
    status: "assigned",
  });

  await createInstance(supabase, {
    templateId: trashTemplateId,
    householdId,
    occurrenceDate: today,
    valueModel: "fixed",
    amountCents: 150,
    photoRequired: false,
    approvalRequired: true,
    status: "available",
    upForGrabs: true,
  });

  const submittedInstanceId = await createInstance(supabase, {
    templateId: bathroomTemplateId,
    householdId,
    childProfileId: willChildProfileId,
    occurrenceDate: today,
    valueModel: "unpaid",
    amountCents: 0,
    photoRequired: true,
    approvalRequired: true,
    status: "assigned",
  });
  await createSubmission(supabase, {
    instanceId: submittedInstanceId,
    childProfileId: willChildProfileId,
    submittedBy: willUser.id,
    note: "Done. Photo upload skipped for seed data.",
  });
  await transitionInstanceStatus(supabase, submittedInstanceId, "submitted");

  const rejectedInstanceId = await createInstance(supabase, {
    templateId: bedTemplateId,
    householdId,
    childProfileId: hollisChildProfileId,
    occurrenceDate: today,
    valueModel: "allowance_included",
    amountCents: 0,
    photoRequired: false,
    approvalRequired: true,
    status: "assigned",
  });
  const rejectedSubmissionId = await createSubmission(supabase, {
    instanceId: rejectedInstanceId,
    childProfileId: hollisChildProfileId,
    submittedBy: hollisUser.id,
    note: "I made it.",
  });
  await transitionInstanceStatus(supabase, rejectedInstanceId, "submitted");
  await transitionInstanceStatus(supabase, rejectedInstanceId, "rejected");
  await supabase.from("approval_events").insert({
    instance_id: rejectedInstanceId,
    submission_id: rejectedSubmissionId,
    actor_profile_id: parentUser.id,
    event_type: "rejected",
    feedback: "Please tuck in the sheets and try again.",
  });

  const approvedInstanceId = await createInstance(supabase, {
    templateId: approvedTemplateId,
    householdId,
    childProfileId: willChildProfileId,
    occurrenceDate: today,
    valueModel: "fixed",
    amountCents: 300,
    photoRequired: false,
    approvalRequired: true,
    status: "assigned",
  });
  const approvedSubmissionId = await createSubmission(supabase, {
    instanceId: approvedInstanceId,
    childProfileId: willChildProfileId,
    submittedBy: willUser.id,
    note: "Towels are done.",
  });
  await transitionInstanceStatus(supabase, approvedInstanceId, "submitted");
  await transitionInstanceStatus(supabase, approvedInstanceId, "approved");
  const approvalEventId = await insertOne(supabase, "approval_events", {
    instance_id: approvedInstanceId,
    submission_id: approvedSubmissionId,
    actor_profile_id: parentUser.id,
    event_type: "approved",
    feedback: "Looks good.",
  });

  const payPeriodId = await insertOne(supabase, "pay_periods", {
    household_id: householdId,
    cycle_type: "weekly",
    start_date: today,
    end_date: addDays(today, 6),
  });

  const { error: ledgerError } = await supabase.from("ledger_transactions").insert({
    child_profile_id: willChildProfileId,
    earning_household_id: householdId,
    payout_household_id: householdId,
    payout_parent_id: parentUser.id,
    pay_period_id: payPeriodId,
    chore_instance_id: approvedInstanceId,
    approval_event_id: approvalEventId,
    transaction_type: "approved_credit",
    amount_cents: 300,
    description: "Seed approved chore credit",
    effective_date: today,
    created_by: parentUser.id,
  });

  if (ledgerError) {
    throw ledgerError;
  }

  console.log("Seeded Cook Household dev data.");
  console.log("");
  console.log("Login credentials:");
  console.log(`  Parent: ${accounts.parent.email} / ${seedPassword}`);
  console.log(`  Will:   ${accounts.will.email} / ${seedPassword}`);
  console.log(`  Hollis: ${accounts.hollis.email} / ${seedPassword}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
