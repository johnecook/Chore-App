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
        <header>
            <div className="container py-3 flex items-center gap-4">
                <Link href="/" className="font-bold">ChoreApp</Link>
                <nav className="flex items-center gap-3 text-sm">
                    {role === 'parent' && (
                        <>
                            <Link href="/parent" className="hover:underline">Chore Admin</Link>
                            <Link href="/parent/earnings" className="hover:underline">Kids' Earnings</Link>
                        </>
                    )}
                    {role === 'kid' && (
                        <>
                            <Link href="/kid" className="hover:underline">My Chores</Link>
                            <Link href="/kid/earnings" className="hover:underline">My Earnings</Link>
                        </>
                    )}
                    {!user && <Link href="/login" className="ml-auto hover:underline">Login</Link>}
                </nav>
            </div>
        </header>
        <main className="container py-6 w-full max-w-2xl px-4">{children}</main>
        </body>
        </html>
    )
}