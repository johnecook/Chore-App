'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

export default function LoginPage() {
    const supabase = supabaseBrowser()
    const router = useRouter()

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
                router.refresh()   // re-render server components with the session
                router.replace('/') // go to Home; your server code redirects to /kid or /parent
            }
            if (event === 'SIGNED_OUT') {
                router.refresh()
            }
        })
        return () => subscription.unsubscribe()
    }, [router, supabase])

    return (
        <div className="max-w-md mx-auto card">
            <h1 className="text-2xl font-bold mb-4">Sign in</h1>
            <Auth
                supabaseClient={supabase}
                providers={[]}
                appearance={{ theme: ThemeSupa, variables: { default: { colors: { inputText: '#ffffff' } } } }}
                view="sign_in"
                // redirectTo mainly affects OAuth; we still listen for SIGNED_IN above
                redirectTo={typeof window !== 'undefined' ? `${window.location.origin}` : undefined}
            />
        </div>
    )
}