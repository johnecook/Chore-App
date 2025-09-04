'use client'
import { useEffect, useMemo, useState } from 'react'
import { RRule } from 'rrule'
import type { Weekday } from 'rrule'
import { formatInTimeZone } from 'date-fns-tz'

const DAY_ORDER = ['MO','TU','WE','TH','FR','SA','SU'] as const
const DAY_LABEL: Record<string,string> = { MO:'Mon', TU:'Tue', WE:'Wed', TH:'Thu', FR:'Fri', SA:'Sat', SU:'Sun' }

export type RRuleBuilderProps = {
    /** Optional initial RRULE string */
    value?: string | null
    /** Called whenever the RRULE string changes (or becomes null when invalid) */
    onChange?: (rrule: string | null) => void
    /** Hidden input name to post with a <form> */
    name?: string
    /** Household anchor date (YYYY-MM-DD) used for preview; optional */
    anchorDate?: string
    /** Household timezone (e.g., 'America/Chicago') for preview; optional */
    timezone?: string
}

type Freq = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export function RRuleBuilder({ value, onChange, name = 'rrule', anchorDate, timezone }: RRuleBuilderProps) {
    const [freq, setFreq] = useState<Freq>('DAILY')
    const [interval, setInterval] = useState<number>(1)
    const [byday, setByday] = useState<string[]>(['MO','TU','WE','TH','FR']) // default weekdays
    const [byMonthDay, setByMonthDay] = useState<number[]>([]) // empty = use anchor day for monthly

    // Initialize from incoming value (if any)
    useEffect(() => {
        if (!value) return
        try {
            const r = RRule.fromString(value)
            const o = r.origOptions
            if (o.freq !== undefined) {
                setFreq((RRule.FREQUENCIES[o.freq] as string).toUpperCase() as Freq)
            }
            setInterval(o.interval ?? 1)
            if (Array.isArray(o.byweekday) && o.byweekday.length) {
                setByday((o.byweekday as Weekday[]).map((w) => DAY_ORDER[w.weekday]))
            }
            if (Array.isArray(o.bymonthday) && o.bymonthday.length) {
                setByMonthDay(o.bymonthday as number[])
            }
        } catch {}
    }, [value])

    // Build the RRULE string from UI state
    const rrule = useMemo(() => {
        const parts = [`FREQ=${freq}`, `INTERVAL=${Math.max(1, Number.isFinite(interval) ? interval : 1)}`]
        if (freq === 'WEEKLY') {
            const days = DAY_ORDER.filter(d => byday.includes(d))
            if (days.length === 0) return null // invalid until a day is picked
            parts.push(`BYDAY=${days.join(',')}`)
        }
        if (freq === 'MONTHLY') {
            if (byMonthDay.length > 0) parts.push(`BYMONTHDAY=${[...byMonthDay].sort((a,b)=>a-b).join(',')}`)
            // if empty, DB logic defaults to anchor day-of-month
        }
        return parts.join(';')
    }, [freq, interval, byday, byMonthDay])

    useEffect(() => { onChange?.(rrule) }, [rrule, onChange])

    // Preview next 5 dates if we have anchor + rrule
    const preview: string[] = useMemo(() => {
        if (!rrule || !anchorDate) return []
        try {
            const base = RRule.fromString(rrule)
            const dtstart = new Date(`${anchorDate}T00:00:00`)
            const withStart = new RRule({ ...base.origOptions, dtstart })
            const dates = withStart.all((_, i) => i < 5)
            return dates.map(d => timezone ? formatInTimeZone(d, timezone, 'EEE MMM d, yyyy') : d.toDateString())
        } catch {
            return []
        }
    }, [rrule, anchorDate, timezone])

    const toggleDay = (code: string) => setByday(prev => prev.includes(code) ? prev.filter(d => d!==code) : [...prev, code])
    const toggleDom = (n: number) => setByMonthDay(prev => prev.includes(n) ? prev.filter(x=>x!==n) : [...prev, n])

    return (
        <div className="space-y-3">
            {name && <input type="hidden" name={name} value={rrule ?? ''} />}

            {/* Frequency & Interval */}
            <div className="grid gap-3 md:grid-cols-3">
                <div>
                    <label className="label">Frequency</label>
                    <select className="input" value={freq} onChange={e => setFreq(e.target.value as Freq)}>
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                    </select>
                </div>
                <div>
                    <label className="label">Interval</label>
                    <input className="input" type="number" min={1} step={1} value={interval}
                           onChange={e => setInterval(parseInt(e.target.value || '1', 10))} />
                    <p className="text-xs text-violet-400 mt-1">Every <b>{interval||1}</b> {freq.toLowerCase()}(s)</p>
                </div>
            </div>

            {/* Weekly day picker */}
            {freq === 'WEEKLY' && (
                <div>
                    <label className="label">Repeat on</label>
                    <div className="grid grid-cols-7 gap-2">
                        {DAY_ORDER.map(code => (
                            <button type="button" key={code}
                                    className={`px-2 py-2 rounded-xl border ${byday.includes(code) ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300'}`}
                                    onClick={() => toggleDay(code)}>
                                {DAY_LABEL[code]}
                            </button>
                        ))}
                    </div>
                    <div className="mt-2 flex gap-2 text-xs">
                        <button type="button" className="badge" onClick={() => setByday(['MO','TU','WE','TH','FR'])}>Weekdays</button>
                        <button type="button" className="badge" onClick={() => setByday(['SA','SU'])}>Weekends</button>
                        <button type="button" className="badge" onClick={() => setByday([...DAY_ORDER])}>Every day</button>
                        <button type="button" className="badge" onClick={() => setByday([])}>Clear</button>
                    </div>
                </div>
            )}

            {/* Monthly day-of-month picker */}
            {freq === 'MONTHLY' && (
                <div>
                    <label className="label">On day(s) of month</label>
                    <div className="grid grid-cols-7 gap-2 max-w-xl">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(n => (
                            <button type="button" key={n}
                                    className={`px-2 py-2 rounded-xl border text-sm ${byMonthDay.includes(n) ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300'}`}
                                    onClick={() => toggleDom(n)}>
                                {n}
                            </button>
                        ))}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                        Leave empty to use your household’s <b>anchor day-of-month</b> for monthly repeats.
                    </div>
                    <div className="mt-2 flex gap-2 text-xs">
                        <button type="button" className="badge" onClick={() => setByMonthDay([1,15])}>1st & 15th</button>
                        <button type="button" className="badge" onClick={() => setByMonthDay([])}>Use anchor</button>
                    </div>
                </div>
            )}

            {/* Preview */}
            <div className="text-sm">
                <div className="label">RRULE</div>
                <code className="block p-2 bg-slate-950 rounded">{rrule ?? '— (pick options)'}</code>
                {preview.length > 0 && (
                    <div className="mt-2">
                        <div className="label">Next 5 occurrences {timezone ? `(local: ${timezone})` : ''}</div>
                        <ul className="list-disc ml-5">
                            {preview.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    )
}