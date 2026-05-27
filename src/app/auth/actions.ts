"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const signUpSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  email: z.email(),
  password: z.string().min(8),
  appRole: z.enum(["parent", "child"]),
});

function authErrorRedirect(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function signInAction(formData: FormData) {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    authErrorRedirect("/sign-in", "Enter a valid email and password.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    authErrorRedirect("/sign-in", error.message);
  }

  redirect("/start");
}

export async function signUpAction(formData: FormData) {
  const parsed = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    appRole: formData.get("appRole"),
  });

  if (!parsed.success) {
    authErrorRedirect("/sign-up", "Enter a name, valid email, and password of at least 8 characters.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        app_role: parsed.data.appRole,
        display_name: parsed.data.displayName,
      },
    },
  });

  if (error) {
    authErrorRedirect("/sign-up", error.message);
  }

  redirect("/start");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
