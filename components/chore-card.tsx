import { Money } from './money'

export function ChoreCard({ title, amount, dueTime, isAnyone }: { title: string; amount: number; dueTime?: string | null; isAnyone?: boolean }) {
    return (
        <div className="card flex items-center justify-between">
            <div>
                <div className="text-lg font-semibold">{title} {isAnyone && <span className="badge ml-2">Anyone</span>}</div>
                {dueTime && <div className="text-sm text-slate-500">Due by {dueTime}</div>}
            </div>
            <div className="text-right">
                <Money value={amount} />
            </div>
        </div>
    )
}