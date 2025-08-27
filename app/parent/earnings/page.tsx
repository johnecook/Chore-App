import FlashBanner from '@/components/flash-banner'
import { Money } from '@/components/money'
import { supabaseServer } from '@/lib/supabase/server'
import { payKid } from '../actions'

async function loadData() {
    const sb = supabaseServer()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return null

    const { data: profile } = await sb.from('profiles').select('id, household_id').eq('id', user.id).single()
    if (!profile) return null

    const [kidsRes, balRes] = await Promise.all([
        sb.from('profiles').select('id, display_name').neq('role','parent'),
        sb.from('vw_kid_balances').select('*'),
    ])

    return { profile, kids: kidsRes.data ?? [], balances: balRes.data ?? [] }
}

export default async function ParentEarningsPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
    const data = await loadData()
    if (!data) return <div>Please login</div>
    const { profile, kids, balances } = data

    const message = typeof searchParams?.flash === 'string' ? searchParams.flash : undefined
    const t = (searchParams?.t as 'success' | 'warn' | 'error') ?? 'success'

    return (
        <div className="space-y-8">
            {message && <FlashBanner message={decodeURIComponent(message)} type={t} />}
            <h1 className="text-2xl font-bold">Kids' earnings</h1>
            <section className="card">
                <h2 className="text-lg font-semibold mb-3">Balances</h2>
                <table className="table">
                    <thead><tr><th>Kid</th><th>Balance</th><th></th></tr></thead>
                    <tbody>
                    {balances.map((b: any) => (
                        <tr key={b.kid_id}>
                            <td>{(kids.find(k => k.id === b.kid_id)?.display_name) ?? b.kid_id}</td>
                            <td><Money value={Number(b.balance_dollars)} /></td>
                            <td>
                                <form action={async () => { 'use server'; await payKid(profile.household_id, b.kid_id) }}>
                                    <button className="btn" type="submit">Pay now</button>
                                </form>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </section>
        </div>
    )
}
