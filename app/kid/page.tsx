import FlashBanner from '@/components/flash-banner'
import { supabaseServer } from '@/lib/supabase/server'
import { ChoreCard } from '@/components/chore-card'
import { completeAssignmentAction } from './actions'

async function getDueToday() {
    const sb = supabaseServer()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return { user: null, rows: [] as any[] }
    const { data: rows, error } = await sb.from('vw_due_today').select('*')
    if (error) throw error
    return { user, rows: rows ?? [] }
}

export default async function KidPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
    const { rows } = await getDueToday()
    const message = typeof searchParams?.flash === 'string' ? searchParams.flash : undefined
    const t = (searchParams?.t as 'success' | 'warn' | 'error') ?? 'success'

    return (
        <div className="space-y-4">
            {message && <FlashBanner message={decodeURIComponent(message)} type={t} />}
            <h1 className="text-2xl font-bold">Today’s chores</h1>
            {rows.length === 0 && <div className="card">Nothing due today 🎉</div>}
            <div className="grid gap-3">
                {rows.map((r) => (
                    <form key={r.assignment_id} action={completeAssignmentAction.bind(null, r.assignment_id)}>
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <ChoreCard title={r.chore_title} amount={Number(r.amount_dollars)} dueTime={r.due_time_local} isAnyone={r.is_anyone} />
                            </div>
                            <button type="submit" className="btn" disabled={r.completed_today}> {r.completed_today ? 'Done' : 'Complete'} </button>
                        </div>
                    </form>
                ))}
            </div>
        </div>
    )
}