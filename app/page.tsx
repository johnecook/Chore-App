import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'

export default async function Home() {
  const sb = supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  // get profile role to decide target
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role === 'parent') redirect('/parent')
  redirect('/kid')
}