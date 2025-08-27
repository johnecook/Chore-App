'use client'
import { useTransition } from 'react'

export function SubmitButton({ pendingText = 'Saving…', children }: { pendingText?: string; children: React.ReactNode }) {
    const [pending] = useTransition()
    return (
        <button
            className="relative inline-flex items-center justify-center rounded-xl px-4 py-2 font-semibold text-primary bg-slate-900 transition-colors before:absolute before:inset-0 before:-z-10 before:rounded-xl before:bg-gradient-to-r before:from-gradient-start before:to-gradient-end before:blur before:opacity-75 hover:text-slate-900 hover:bg-gradient-to-r hover:from-gradient-start hover:to-gradient-end disabled:opacity-50"
            disabled={pending}
        >
            {pending ? pendingText : children}
        </button>
    )
}