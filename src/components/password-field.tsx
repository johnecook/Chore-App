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
      <div className="relative">
        <input
          autoComplete={autoComplete}
          className="min-h-12 w-full min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 pr-14 text-lg"
          id={inputId}
          minLength={minLength}
          name={name}
          required
          type={isVisible ? "text" : "password"}
        />
        <button
          aria-controls={inputId}
          aria-label={isVisible ? "Hide password" : "Show password"}
          aria-pressed={isVisible}
          className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-[var(--accent-strong)] hover:bg-white/10 focus-visible:outline-offset-0"
          onClick={() => setIsVisible((current) => !current)}
          type="button"
        >
          {isVisible ? (
            <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
              <path
                d="m4 4 16 16M9.9 9.9a3 3 0 0 0 4.2 4.2M7.1 7.7C4.8 9 3.2 11 2.5 12c1.6 2.5 4.9 6 9.5 6 1.4 0 2.7-.3 3.8-.9M10.6 6.1c.5-.1.9-.1 1.4-.1 4.6 0 7.9 3.5 9.5 6-.5.8-1.4 1.9-2.5 2.9"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          ) : (
            <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
              <path
                d="M2.5 12c1.6-2.5 4.9-6 9.5-6s7.9 3.5 9.5 6c-1.6 2.5-4.9 6-9.5 6s-7.9-3.5-9.5-6Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
              <path
                d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
