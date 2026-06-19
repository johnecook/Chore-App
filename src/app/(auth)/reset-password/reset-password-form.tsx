"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { PasswordField } from "@/components/password-field";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Status = "checking" | "ready" | "invalid" | "saving" | "saved";

function fragmentParams() {
  if (typeof window === "undefined" || !window.location.hash) {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.hash.slice(1));
}

export function ResetPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let isMounted = true;

    async function prepareSession() {
      const supabase = createSupabaseBrowserClient();
      const params = fragmentParams();
      const hashError = params.get("error_description") ?? params.get("error");
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (hashError) {
        setError(hashError);
        setStatus("invalid");
        return;
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        window.history.replaceState(null, "", window.location.pathname);

        if (sessionError) {
          setError(sessionError.message);
          setStatus("invalid");
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      setStatus(session ? "ready" : "invalid");
    }

    void prepareSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setStatus("saving");

    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setStatus("ready");
      return;
    }

    setStatus("saved");
  }

  if (status === "checking") {
    return (
      <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-4 text-base text-[var(--muted)]">
        Checking your reset link...
      </p>
    );
  }

  if (status === "invalid") {
    return (
      <div className="grid gap-4 rounded-2xl border border-[var(--danger)] bg-[var(--surface-elevated)] p-4 text-base text-[var(--muted)]">
        <p className="font-medium text-[var(--danger)]">
          {error ?? "This reset link is invalid or has expired."}
        </p>
        <Link className="font-semibold text-[var(--accent-strong)]" href="/forgot-password">
          Request another reset link
        </Link>
      </div>
    );
  }

  if (status === "saved") {
    return (
      <div className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-4 text-base text-[var(--muted)]">
        <p>Your password has been updated.</p>
        <Link className="font-semibold text-[var(--accent-strong)]" href="/sign-in">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      {error ? (
        <p className="rounded-2xl border border-[var(--danger)] bg-[var(--surface-elevated)] p-4 text-lg font-medium text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <PasswordField autoComplete="new-password" label="New password" minLength={8} name="password" />
      <PasswordField autoComplete="new-password" label="Confirm password" minLength={8} name="confirmPassword" />

      <button
        className="min-h-12 rounded-2xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-white disabled:opacity-60"
        disabled={status === "saving"}
      >
        {status === "saving" ? "Saving..." : "Update password"}
      </button>
    </form>
  );
}
