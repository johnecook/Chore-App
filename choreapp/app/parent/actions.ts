'use server'
import { supabaseServerAction } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function upsertChore(formData: FormData) {
    const sb = supabaseServerAction()
    const title = String(formData.get('title') || '')
    const amount = Number(formData.get('amount') || 0)
    const householdId = String(formData.get('household_id'))
    if (!title) throw new Error('Missing title')
    const { error } = await sb.from('chores').upsert({ title, default_amount: amount, household_id: householdId }, { onConflict: 'household_id,title' })
    if (error) redirect('/parent?flash=' + encodeURIComponent('Failed to save chore') + '&t=error')
    redirect('/parent?flash=' + encodeURIComponent('Chore saved') + '&t=success')
}

export async function createAssignment(formData: FormData) {
    const sb = supabaseServerAction()
    const choreId = String(formData.get('chore_id'))
    const kidId = String(formData.get('kid_id') || '') || null
    const amountOverride = formData.get('amount_override') ? Number(formData.get('amount_override')) : null
    const dueAt = formData.get('due_at') ? new Date(String(formData.get('due_at'))) : null
    const rrule = String(formData.get('rrule') || '') || null

    const { error } = await sb.from('assignments').insert({ chore_id: choreId, kid_id: kidId, amount_override: amountOverride, due_at: dueAt, rrule })
    if (error) redirect('/parent?flash=' + encodeURIComponent('Failed to create assignment') + '&t=error')
    redirect('/parent?flash=' + encodeURIComponent('Assignment created') + '&t=success')
}

export async function verifyCheckin(id: string) {
    const sb = supabaseServerAction()
    const { error } = await sb.from('checkins').update({ verified: true }).eq('id', id)
    if (error) redirect('/parent?flash=' + encodeURIComponent('Failed to verify') + '&t=error')
    redirect('/parent?flash=' + encodeURIComponent('Check-in verified') + '&t=success')
}

export async function payKid(householdId: string, kidId: string) {
    const sb = supabaseServerAction()
    const { error } = await sb.rpc('create_full_payout_for_kid', { hh: householdId, kid: kidId })
    const base = '/parent/earnings'
    if (error) redirect(base + '?flash=' + encodeURIComponent('Payout failed') + '&t=error')
    redirect(base + '?flash=' + encodeURIComponent('Payout recorded') + '&t=success')
}
export async function updateAssignment(formData: FormData) {
    const sb = supabaseServerAction()
    const id = String(formData.get('id'))
    const choreId = String(formData.get('chore_id'))
    const kidId = String(formData.get('kid_id') || '') || null
    const amountOverride = formData.get('amount_override') ? Number(formData.get('amount_override')) : null
    const dueAt = formData.get('due_at') ? new Date(String(formData.get('due_at'))) : null
    const rrule = String(formData.get('rrule') || '') || null
    const { error } = await sb.from('assignments').update({ chore_id: choreId, kid_id: kidId, amount_override: amountOverride, due_at: dueAt, rrule }).eq('id', id)
    if (error) redirect('/parent/assignments?flash=' + encodeURIComponent('Failed to update assignment') + '&t=error')
    redirect('/parent/assignments?flash=' + encodeURIComponent('Assignment updated') + '&t=success')
}

export async function deleteAssignment(id: string) {
    const sb = supabaseServerAction()
    const { error } = await sb.from('assignments').delete().eq('id', id)
    if (error) redirect('/parent/assignments?flash=' + encodeURIComponent('Failed to delete assignment') + '&t=error')
    redirect('/parent/assignments?flash=' + encodeURIComponent('Assignment deleted') + '&t=success')
}

