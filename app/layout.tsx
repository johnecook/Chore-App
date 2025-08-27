import './globals.css'
import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'

export const metadata = {
    title: 'ChoreApp',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const sb = supabaseServer()
    const { data: { user } } = await sb.auth.getUser()
    let role: string | null = null
    if (user) {
        const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
        role = profile?.role ?? null
    }

    return (
        <html lang="en">
        <body className="flex justify-center">
        <div className="w-full shadow-lg bg-gradient-to-r from-gradient-start to-gradient-end">
            <header>
                <div className="container py-3 flex items-center gap-4">
                    <Link href="/" className="text-2xl font-extrabold bg-gradient-to-r from-gradient-start to-gradient-end bg-clip-text text-transparent">ChoreApp</Link>
                    <nav className="ml-auto flex items-center gap-6 text-sm font-medium">
                        {role === 'parent' && (
                            <>
                                <Link href="/parent" className="transition-colors hover:text-secondary">Chore Admin</Link>
                                <Link href="/parent/earnings" className="transition-colors hover:text-secondary">Kids' Earnings</Link>
                            </>
                        )}
                        {role === 'kid' && (
                            <>
                                <Link href="/kid" className="transition-colors hover:text-secondary">My Chores</Link>
                                <Link href="/kid/earnings" className="transition-colors hover:text-secondary">My Earnings</Link>
                            </>
                        )}
                        {!user && <Link href="/login" className="transition-colors hover:text-secondary">Login</Link>}
                    </nav>
                </div>
            </header>
        </div>
        <main className="container py-6 w-full max-w-2xl px-4">{children}</main>
        </body>
        </html>
    )
}
