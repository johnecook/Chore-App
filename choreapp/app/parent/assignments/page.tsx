import FlashBanner from '@/components/flash-banner'
import { RRuleBuilder } from '@/components/rrule-builder'
import { supabaseServer } from '@/lib/supabase/server'
import { updateAssignment, deleteAssignment } from '../actions'

async function loadData() {
    const sb = supabaseServer()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return null

    const { data: profile } = await sb.from('profiles').select('id, household_id').eq('id', user.id).single()
    if (!profile) return null

    const { data: household } = await sb.from('households').select('timezone, allowance_anchor_date').eq('id', profile.household_id).single()

    const [asRes, choresRes, kidsRes] = await Promise.all([
        sb.from('assignments').select('id, chore_id, kid_id, amount_override, due_at, rrule').order('created_at', { ascending: true }),
        sb.from('chores').select('id, title').eq('household_id', profile.household_id),
        sb.from('profiles').select('id, display_name').neq('role','parent').eq('household_id', profile.household_id),
    ])

    return { household, assignments: asRes.data ?? [], chores: choresRes.data ?? [], kids: kidsRes.data ?? [] }
}

export default async function ParentAssignmentsPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
    const data = await loadData()
    if (!data) return <div>Please login</div>
    const { household, assignments, chores, kids } = data

    const message = typeof searchParams?.flash === 'string' ? searchParams.flash : undefined
    const t = (searchParams?.t as 'success' | 'warn' | 'error') ?? 'success'

    return (
        <div className="space-y-8">
            {message && <FlashBanner message={decodeURIComponent(message)} type={t} />}
            <h1 className="text-2xl font-bold">Assignments</h1>
            <section className="card">
                <h2 className="text-lg font-semibold mb-3">Current assignments</h2>
                <div className="space-y-6">
                    {assignments.map(a => (
                        <div key={a.id} className="p-4 border rounded space-y-2">
                            <form action={updateAssignment} className="grid gap-4 md:grid-cols-3">
                                <input type="hidden" name="id" value={a.id} />
                                <div>
                                    <label className="label">Chore</label>
                                    <select className="input" name="chore_id" defaultValue={a.chore_id}>
                                        {chores.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Kid (blank = Anyone)</label>
                                    <select className="input" name="kid_id" defaultValue={a.kid_id ?? ''}>
                                        <option value="">Anyone</option>
                                        {kids.map(k => <option key={k.id} value={k.id}>{k.display_name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Amount override ($)</label>
                                    <input className="input" name="amount_override" type="number" step="0.01" min="0" defaultValue={a.amount_override ?? ''} />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="label">Repeat</label>
                                    <div className="theme-auth">
                                        <RRuleBuilder name="rrule" value={a.rrule} anchorDate={household?.allowance_anchor_date ?? undefined} timezone={household?.timezone ?? undefined} />
                                    </div>
                                </div>
                                <div>
                                    <label className="label">Due at (timestamp)</label>
                                    <input className="input" name="due_at" type="datetime-local" defaultValue={a.due_at ? new Date(a.due_at).toISOString().slice(0,16) : ''} />
                                </div>
                                <div className="flex items-end gap-2">
                                    <button className="btn" type="submit">Save</button>
                                </div>
                            </form>
                            <form action={async () => { 'use server'; await deleteAssignment(a.id) }}>
                                <button className="btn" type="submit">Delete</button>
                            </form>
                        </div>
                    ))}
                    {assignments.length === 0 && <p>No assignments yet.</p>}
                </div>
            </section>
        </div>
    )
}
