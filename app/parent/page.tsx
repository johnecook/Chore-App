import FlashBanner from '@/components/flash-banner'
import { supabaseServer } from '@/lib/supabase/server'
import { upsertChore, createAssignment, verifyCheckin } from './actions'
import { RRuleBuilder } from '@/components/rrule-builder'

async function loadData() {
    const sb = supabaseServer()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return null

    const { data: profile } = await sb.from('profiles').select('id, role, household_id, display_name').eq('id', user.id).single()
    if (!profile) return null

    const { data: household } = await sb.from('households').select('id, name, timezone, allowance_anchor_date').eq('id', profile.household_id).single()

    const [chRes, kidsRes, ciRes] = await Promise.all([
        sb.from('chores').select('id, title, default_amount, household_id'),
        sb.from('profiles').select('id, display_name').neq('role','parent'),
        sb.from('checkins').select('id, assignment_id, completed_at, verified, completed_by').order('completed_at', { ascending: false }).limit(50),
    ])

    return { user, profile, household, hhChores: chRes.data ?? [], kids: kidsRes.data ?? [], checkins: ciRes.data ?? [] }
}

export default async function ParentPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
    const data = await loadData()
    if (!data) return <div>Please login</div>
    const { profile, household, hhChores, kids, checkins } = data

    const message = typeof searchParams?.flash === 'string' ? searchParams.flash : undefined
    const t = (searchParams?.t as 'success' | 'warn' | 'error') ?? 'success'

    return (
        <div className="space-y-8">
            {message && <FlashBanner message={decodeURIComponent(message)} type={t} />}
            <h1 className="text-2xl font-bold">Chore admin</h1>

            {/* Create Chore */}
            <section className="card">
                <h2 className="text-lg font-semibold mb-3">Create chore</h2>
                <form action={upsertChore} className="grid gap-3 md:grid-cols-3">
                    <input type="hidden" name="household_id" value={profile.household_id} />
                    <div>
                        <label className="label">Title</label>
                        <input className="input" name="title" placeholder="e.g., Load dishwasher" />
                    </div>
                    <div>
                        <label className="label">Default amount ($)</label>
                        <input className="input" name="amount" type="number" step="0.01" min="0" defaultValue={1.00} />
                    </div>
                    <div className="flex items-end">
                        <button className="btn" type="submit">Save chore</button>
                    </div>
                </form>
            </section>

            {/* Create Assignment */}
            <section className="card">
                <h2 className="text-lg font-semibold mb-3">Create assignment</h2>
                <form action={createAssignment} className="grid gap-4">
                    <div className="grid gap-3 md:grid-cols-3">
                        <div>
                            <label className="label">Chore</label>
                            <select className="input" name="chore_id">
                                {hhChores.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Kid (blank = Anyone)</label>
                            <select className="input" name="kid_id" defaultValue="">
                                <option value="">Anyone</option>
                                {kids.map(k => <option key={k.id} value={k.id}>{k.display_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Amount override ($)</label>
                            <input className="input" name="amount_override" type="number" step="0.01" min="0" placeholder="optional" />
                        </div>
                    </div>

                    <div>
                        <label className="label">Repeat</label>
                        <div className="theme-auth">
                            <RRuleBuilder name="rrule" anchorDate={household?.allowance_anchor_date ?? undefined} timezone={household?.timezone ?? undefined} />
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                        <div>
                            <label className="label">Due at (timestamp)</label>
                            <input className="input" name="due_at" type="datetime-local" />
                        </div>
                        <div className="flex items-end">
                            <button className="btn" type="submit">Create assignment</button>
                        </div>
                    </div>
                </form>
            </section>

            {/* Recent check-ins to verify */}
            <section className="card">
                <h2 className="text-lg font-semibold mb-3">Check-ins to verify</h2>
                <table className="table">
                    <thead>
                    <tr><th>When</th><th>Completed by</th><th>Verified</th><th></th></tr>
                    </thead>
                    <tbody>
                    {checkins.map(ci => (
                        <tr key={ci.id}>
                            <td>{new Date(ci.completed_at).toLocaleString()}</td>
                            <td className="text-slate-600">{ci.completed_by}</td>
                            <td>{ci.verified ? 'Yes' : 'No'}</td>
                            <td>
                                {!ci.verified && (
                                    <form action={async () => { 'use server'; await verifyCheckin(ci.id) }}>
                                        <button className="btn" type="submit">Verify</button>
                                    </form>
                                )}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </section>


        </div>
    )
}