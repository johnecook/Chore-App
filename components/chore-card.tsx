import { Money } from './money'

export function ChoreCard({ title, amount, dueTime, isAnyone }: { title: string; amount: number; dueTime?: string | null; isAnyone?: boolean }) {
    return (
        <div className="rounded-2xl bg-gradient-to-r from-gradient-start to-gradient-end p-px">
            <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-4">
                <div>
                    <div className="text-lg font-semibold text-primary">
                        {title} {isAnyone && <span className="badge ml-2">Anyone</span>}
                    </div>
                    {dueTime && <div className="text-sm text-secondary">Due by {dueTime}</div>}
                </div>
                <div className="text-right text-primary">
                    <Money value={amount} />
                </div>
            </div>
        </div>
    )
}