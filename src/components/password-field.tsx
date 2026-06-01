"use client";

import { useId, useState } from "react";

type PasswordFieldProps = {
  autoComplete: string;
  label: string;
  minLength?: number;
  name: string;
};

export function PasswordField({ autoComplete, label, minLength, name }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const inputId = useId();

  return (
    <div className="grid gap-2 text-lg font-semibold">
      <label htmlFor={inputId}>{label}</label>
      <div className="grid gap-2 sm:flex sm:items-stretch">
        <input
          autoComplete={autoComplete}
          className="min-h-12 min-w-0 flex-1 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg"
          id={inputId}
          minLength={minLength}
          name={name}
          required
          type={isVisible ? "text" : "password"}
        />
        <button
          aria-controls={inputId}
          aria-pressed={isVisible}
          className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-lg font-semibold text-[var(--accent-strong)]"
          onClick={() => setIsVisible((current) => !current)}
          type="button"
        >
          {isVisible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
