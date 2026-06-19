"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getInviteSignupContext } from "@/lib/invitations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  invitationId: z.uuid().optional(),
  next: z.string().optional(),
});

const signUpSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  email: z.email(),
  password: z.string().min(8),
  appRole: z.enum(["parent", "child"]).optional(),
  invitationId: z.uuid().optional(),
  next: z.string().optional(),
});

const passwordResetRequestSchema = z.object({
  email: z.email(),
});

function safeNextPath(rawNext: string | null | undefined) {
  if (!rawNext || !rawNext.startsWith("/") || rawNext.startsWith("//")) {
    return "/start";
  }

  return rawNext;
}

function inviteNextPath(invitationId: string | null | undefined, rawNext: string | null | undefined) {
  if (rawNext?.startsWith("/") && !rawNext.startsWith("//")) {
    return rawNext;
  }

  return invitationId ? `/invite/${invitationId}` : "/start";
}

function configuredAppOrigin() {
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    return null;
  }

  return new URL(appUrl).origin;
}

async function requestAppOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");

  if (!host) {
    return "http://localhost:3000";
  }

  const proto =
    headerStore.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");

  return `${proto}://${host}`;
}

async function createEmailRedirectTo(invitationId?: string, next?: string) {
  const origin = configuredAppOrigin() ?? await requestAppOrigin();
  const redirectUrl = new URL("/sign-in", origin);
  const nextPath = inviteNextPath(invitationId, next);

  if (invitationId) {
    redirectUrl.searchParams.set("invite", invitationId);
  }

  if (nextPath !== "/start") {
    redirectUrl.searchParams.set("next", nextPath);
  }

  return redirectUrl.toString();
}

async function createPasswordResetRedirectTo() {
  const origin = configuredAppOrigin() ?? await requestAppOrigin();

  return new URL("/reset-password", origin).toString();
}

function signUpErrorRedirect(message: string, invitationId?: string, next?: string): never {
  const params = new URLSearchParams({ error: message });

  if (invitationId) {
    params.set("invite", invitationId);
  }

  if (next) {
    params.set("next", safeNextPath(next));
  }

  redirect(`/sign-up?${params.toString()}`);
}

function signInErrorRedirect(message: string, invitationId?: string, next?: string): never {
  const params = new URLSearchParams({ error: message });

  if (invitationId) {
    params.set("invite", invitationId);
  }

  if (next) {
    params.set("next", safeNextPath(next));
  }

  redirect(`/sign-in?${params.toString()}`);
}

export async function signInAction(formData: FormData) {
  const rawInvitationId = formData.get("invitationId")?.toString();
  const rawNext = formData.get("next")?.toString();
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    invitationId: rawInvitationId || undefined,
    next: rawNext || undefined,
  });

  if (!parsed.success) {
    signInErrorRedirect("Enter a valid email and password.", rawInvitationId, rawNext);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    signInErrorRedirect(error.message, parsed.data.invitationId, parsed.data.next);
  }

  redirect(inviteNextPath(parsed.data.invitationId, parsed.data.next));
}

export async function signUpAction(formData: FormData) {
  const rawInvitationId = formData.get("invitationId")?.toString();
  const rawNext = formData.get("next")?.toString();
  const parsed = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    appRole: formData.get("appRole") || undefined,
    invitationId: rawInvitationId || undefined,
    next: rawNext || undefined,
  });

  if (!parsed.success) {
    signUpErrorRedirect(
      "Enter a name, valid email, and password of at least 8 characters.",
      rawInvitationId,
      rawNext,
    );
  }

  const invite = await getInviteSignupContext(parsed.data.invitationId);
  const appRole = invite?.role ?? parsed.data.appRole;

  if (!appRole) {
    signUpErrorRedirect(
      "Choose whether this account is for a parent or child.",
      parsed.data.invitationId,
      parsed.data.next,
    );
  }

  if (invite && parsed.data.email.toLowerCase() !== invite.email.toLowerCase()) {
    signUpErrorRedirect(
      `Use the email address this ${invite.role} invite was sent to.`,
      invite.id,
      parsed.data.next,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        app_role: appRole,
        display_name: parsed.data.displayName,
      },
      emailRedirectTo: await createEmailRedirectTo(parsed.data.invitationId, parsed.data.next),
    },
  });

  if (error) {
    signUpErrorRedirect(error.message, parsed.data.invitationId, parsed.data.next);
  }

  const params = new URLSearchParams({ email: parsed.data.email });
  const nextPath = inviteNextPath(parsed.data.invitationId, parsed.data.next);

  if (nextPath !== "/start") {
    params.set("next", nextPath);
  }

  if (parsed.data.invitationId) {
    params.set("invite", parsed.data.invitationId);
  }

  redirect(`/check-email?${params.toString()}`);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export async function requestPasswordResetAction(formData: FormData) {
  const parsed = passwordResetRequestSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    redirect("/forgot-password?error=Enter a valid email address.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: await createPasswordResetRedirectTo(),
  });

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/forgot-password?sent=${encodeURIComponent(parsed.data.email)}`);
}
