import { supabaseServer } from '@/lib/supabase/server'
import { Money } from '@/components/money'

async function loadData() {
    const sb = supabaseServer()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return null
    const { data } = await sb.from('vw_kid_balances').select('*').eq('kid_id', user.id).single()
    if (!data) return null
    return data
}

export default async function KidEarningsPage() {
    const balance = await loadData()
    if (!balance) return <div>Please login</div>
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">My earnings</h1>
            <div className="card flex justify-between">
                <span>Total earned</span>
                <span><Money value={Number(balance.balance_dollars)} /></span>
            </div>
        </div>
    )
}
