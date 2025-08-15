'use client'
import { useEffect, useState } from 'react'

export default function FlashBanner({ message, type = 'success' }: { message: string; type?: 'success' | 'warn' | 'error' }) {
    const [open, setOpen] = useState(true)
    useEffect(() => {
        const t = setTimeout(() => setOpen(false), 3000)
        return () => clearTimeout(t)
    }, [])
    if (!open) return null
    const color = type === 'error' ? 'flash-error' : type === 'warn' ? 'flash-warn' : 'flash-success'
    return (
        <div className={`flash-banner ${color}`} role="status" aria-live="polite">
            <div className="flex items-center gap-3">
                <span>{message}</span>
                <button type="button" className="ml-2 rounded-lg bg-white/20 px-2 py-1" onClick={() => setOpen(false)}>✕</button>
            </div>
        </div>
    )
}