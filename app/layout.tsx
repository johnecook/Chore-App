import './globals.css'
import Link from 'next/link'

export const metadata = {
    title: 'ChoreApp',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
        <body className="flex justify-center">
        <header>
            <div className="container py-3 flex items-center gap-4">
                <Link href="/" className="font-bold">ChoreApp</Link>
                <nav className="flex items-center gap-3 text-sm">
                    <Link href="/kid" className="hover:underline">Kid</Link>
                    <Link href="/parent" className="hover:underline">Parent</Link>
                    <Link href="/login" className="ml-auto hover:underline">Login</Link>
                </nav>
            </div>
        </header>
        <main className="container py-6 w-full max-w-2xl px-4">{children}</main>
        </body>
        </html>
    )
}