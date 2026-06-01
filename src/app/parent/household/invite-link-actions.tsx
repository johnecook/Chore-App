"use client";

import { useState } from "react";

export function InviteLinkActions({
  email,
  inviteUrl,
}: {
  email: string;
  inviteUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyInviteLink() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const subject = encodeURIComponent("Your Rhythm household invite");
  const body = encodeURIComponent(`Use this link to join our Rhythm household:\n\n${inviteUrl}`);

  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="min-h-11 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2 text-base font-semibold"
        onClick={copyInviteLink}
        type="button"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
      <a
        className="inline-flex min-h-11 items-center rounded-2xl bg-[var(--accent)] px-4 py-2 text-base font-semibold text-white"
        href={`mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`}
      >
        Send email
      </a>
    </div>
  );
}
