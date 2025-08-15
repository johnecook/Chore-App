'use client'
import { useTransition } from 'react'

export function SubmitButton({ pendingText = 'Saving…', children }: { pendingText?: string; children: React.ReactNode }) {
    const [pending] = useTransition()
    return <button className="btn" disabled={pending}>{pending ? pendingText : children}</button>
}