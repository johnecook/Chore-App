'use client'
import { useEffect, useState } from 'react'

export default function FlashBanner({ message, type = 'success' }: { message: string; type?: 'success' | 'warn' | 'error' }) {
    const [open, setOpen] = useState(true)
    useEffect(() => {
        const t = setTimeout(() => setOpen(false), 3000)
        return () => clearTimeout(t)
    }, [])
    if (!open) return null
    const color =
        type === 'error'
            ? 'from-secondary to-rose-600'
            : type === 'warn'
            ? 'from-amber-400 to-secondary'
            : 'from-gradient-start to-gradient-end'
    return (
        <div className={`flash-banner bg-gradient-to-r ${color}`} role="status" aria-live="polite">
            <div className="flex items-center gap-3">
                <span>{message}</span>
                <button type="button" className="ml-2 rounded-lg bg-slate-900/20 px-2 py-1" onClick={() => setOpen(false)}>
                    ✕
                </button>
            </div>
        </div>
    )
}