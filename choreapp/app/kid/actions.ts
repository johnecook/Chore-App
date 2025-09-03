'use server'
import { supabaseServerAction } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function completeAssignment(assignmentId: string) {
    const sb = supabaseServerAction()
    const { data: { user }, error: ue } = await sb.auth.getUser()
    if (ue) throw ue
    if (!user) throw new Error('Not signed in')

    const { error } = await sb
        .from('checkins')
        .insert({ assignment_id: assignmentId, completed_by: user.id, verified: false })

    if (error && (error as any).code === '23505') {
        return { ok: false, alreadyClaimed: true }
    }
    if (error) throw error
    return { ok: true }
}

// Form-friendly action that redirects with a flash banner
export async function completeAssignmentAction(assignmentId: string) {
    const sb = supabaseServerAction()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) redirect('/login')

    const { error } = await sb
        .from('checkins')
        .insert({ assignment_id: assignmentId, completed_by: user.id, verified: false })

    if (error && (error as any).code === '23505') {
        redirect('/kid?flash=' + encodeURIComponent('Already claimed by someone else') + '&t=warn')
    }
    if (error) {
        redirect('/kid?flash=' + encodeURIComponent('Failed to complete chore') + '&t=error')
    }
    redirect('/kid?flash=' + encodeURIComponent('Chore completed!') + '&t=success')
}
