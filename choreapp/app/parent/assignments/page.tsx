import FlashBanner from '@/components/flash-banner'
import { supabaseServer } from '@/lib/supabase/server'
import { AssignmentEditor } from '@/components/assignment-editor'

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
            <section className="space-y-6">
                {kids.map(k => {
                    const kidAssignments = assignments.filter(a => a.kid_id === k.id)
                    return (
                        <div key={k.id} className="card">
                            <h2 className="text-lg font-semibold mb-3">{k.display_name}</h2>
                            <div className="space-y-2">
                                {kidAssignments.map(a => (
                                    <AssignmentEditor key={a.id} assignment={a} chores={chores} kids={kids} household={household} />
                                ))}
                                {kidAssignments.length === 0 && <p>No assignments.</p>}
                            </div>
                        </div>
                    )
                })}
                {assignments.filter(a => !a.kid_id).length > 0 && (
                    <div className="card">
                        <h2 className="text-lg font-semibold mb-3">Anyone</h2>
                        <div className="space-y-2">
                            {assignments.filter(a => !a.kid_id).map(a => (
                                <AssignmentEditor key={a.id} assignment={a} chores={chores} kids={kids} household={household} />
                            ))}
                        </div>
                    </div>
                )}
                {assignments.length === 0 && <p>No assignments yet.</p>}
            </section>
        </div>
    )
}
