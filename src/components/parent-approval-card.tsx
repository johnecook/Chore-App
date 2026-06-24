"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  approveSubmissionInlineAction,
  rejectSubmissionInlineAction,
} from "@/app/parent/actions";
import { Button } from "@/components/ui";

export function ParentApprovalCard({
  children,
  instanceId,
  submissionId,
}: {
  children: ReactNode;
  instanceId: string;
  submissionId?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resolvedMessage, setResolvedMessage] = useState<string | null>(null);

  if (resolvedMessage) {
    return (
      <div
        aria-live="polite"
        className="rounded-3xl border border-[var(--line)] bg-[var(--surface-soft)] p-4 text-base font-semibold text-[var(--muted)]"
      >
        {resolvedMessage}
      </div>
    );
  }

  return (
    <article
      className="grid gap-4 rounded-3xl border border-[var(--line)] bg-[var(--surface-soft)] p-4"
      id={`approval-${instanceId}`}
    >
      {children}

      {submissionId ? (
        <div className="grid gap-3">
          {error ? (
            <p aria-live="polite" className="text-base font-semibold text-[var(--danger)]">
              {error}
            </p>
          ) : null}

          <form
            action={(formData) => {
              setError(null);
              startTransition(async () => {
                const result = await approveSubmissionInlineAction(formData);

                if (result.ok) {
                  setResolvedMessage("Chore approved.");
                  return;
                }

                setError(result.error ?? "Could not approve chore.");
              });
            }}
            className="grid gap-3"
          >
            <input name="submissionId" type="hidden" value={submissionId} />
            <label className="grid gap-2 text-base font-semibold">
              Approval note
              <input
                className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-lg"
                disabled={isPending}
                maxLength={500}
                name="feedback"
                type="text"
              />
            </label>
            <Button disabled={isPending}>
              {isPending ? "Working..." : "Approve"}
            </Button>
          </form>

          <form
            action={(formData) => {
              setError(null);
              startTransition(async () => {
                const result = await rejectSubmissionInlineAction(formData);

                if (result.ok) {
                  setResolvedMessage("Chore sent back.");
                  return;
                }

                setError(result.error ?? "Could not send chore back.");
              });
            }}
            className="grid gap-3"
          >
            <input name="submissionId" type="hidden" value={submissionId} />
            <label className="grid gap-2 text-base font-semibold">
              Send back note
              <input
                className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-lg"
                disabled={isPending}
                maxLength={500}
                name="feedback"
                required
                type="text"
              />
            </label>
            <Button disabled={isPending} variant="danger">
              {isPending ? "Working..." : "Send back"}
            </Button>
          </form>
        </div>
      ) : null}
    </article>
  );
}
