'use client'
import { useState } from 'react'
import { RRuleBuilder } from '@/components/rrule-builder'
import { updateAssignment, deleteAssignment } from '@/app/parent/actions'

type Assignment = {
    id: string
    chore_id: string
    kid_id: string | null
    amount_override: number | null
    due_at: string | null
    rrule: string | null
}

type Chore = { id: string, title: string }

type Kid = { id: string, display_name: string }

type Household = { allowance_anchor_date: string | null, timezone: string | null }

type Props = {
    assignment: Assignment
    chores: Chore[]
    kids: Kid[]
    household: Household | null
}

export function AssignmentEditor({ assignment, chores, kids, household }: Props) {
    const [open, setOpen] = useState(false)
    const chore = chores.find(c => c.id === assignment.chore_id)
    const close = () => setOpen(false)

    return (
        <>
            <button type="button" className="text-blue-600 underline" onClick={() => setOpen(true)}>
                {chore?.title ?? 'Unknown chore'}
            </button>
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={close}>
                    <div className="bg-white rounded p-4 w-full max-w-2xl overflow-y-auto max-h-full" onClick={e => e.stopPropagation()}>
                        <form action={updateAssignment} className="grid gap-4 md:grid-cols-3">
                            <input type="hidden" name="id" value={assignment.id} />
                            <div>
                                <label className="label">Chore</label>
                                <select className="input" name="chore_id" defaultValue={assignment.chore_id}>
                                    {chores.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="label">Kid (blank = Anyone)</label>
                                <select className="input" name="kid_id" defaultValue={assignment.kid_id ?? ''}>
                                    <option value="">Anyone</option>
                                    {kids.map(k => <option key={k.id} value={k.id}>{k.display_name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="label">Amount override ($)</label>
                                <input className="input" name="amount_override" type="number" step="0.01" min="0" defaultValue={assignment.amount_override ?? ''} />
                            </div>
                            <div className="md:col-span-3">
                                <label className="label">Repeat</label>
                                <div className="theme-auth">
                                    <RRuleBuilder name="rrule" value={assignment.rrule} anchorDate={household?.allowance_anchor_date ?? undefined} timezone={household?.timezone ?? undefined} />
                                </div>
                            </div>
                            <div>
                                <label className="label">Due at (timestamp)</label>
                                <input className="input" name="due_at" type="datetime-local" defaultValue={assignment.due_at ? new Date(assignment.due_at).toISOString().slice(0,16) : ''} />
                            </div>
                            <div className="flex items-end gap-2 md:col-span-3 justify-end">
                                <button type="button" className="btn" onClick={close}>Cancel</button>
                                <button className="btn" type="submit">Save</button>
                            </div>
                        </form>
                        <form action={deleteAssignment.bind(null, assignment.id)} className="mt-2 flex justify-end">
                            <button className="btn" type="submit">Delete</button>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}

