import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Read-only Supabase client for Server Components. This variant only exposes
 * `get` so that it cannot modify cookies when invoked outside of a Server
 * Action or Route Handler.
 */
export function supabaseServer() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
      } as any,
    }
  )
}

/**
 * Full Supabase client for use in Server Actions or Route Handlers where
 * mutating cookies is allowed.
 */
export function supabaseServerAction() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) =>
          cookieStore.set({ name, value, ...options }),
        remove: (name: string, options: CookieOptions) =>
          cookieStore.set({ name, value: '', ...options }),
      } as any,
    }
  )
}