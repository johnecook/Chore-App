-- Storage bucket and access policies for chore submission photo evidence.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'chore-submission-photos',
  'chore-submission-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Children can upload own chore submission photos"
on storage.objects for insert
with check (
  bucket_id = 'chore-submission-photos'
  and auth.uid() is not null
  and name like auth.uid()::text || '/%'
);

create policy "Photo owners can read own chore submission photos"
on storage.objects for select
using (
  bucket_id = 'chore-submission-photos'
  and auth.uid() is not null
  and name like auth.uid()::text || '/%'
);

create policy "Household members can read submitted chore photos"
on storage.objects for select
using (
  bucket_id = 'chore-submission-photos'
  and exists (
    select 1
    from public.chore_submissions submission
    join public.chore_instances instance
      on instance.id = submission.instance_id
    where submission.photo_storage_path = storage.objects.name
      and submission.photo_deleted_at is null
      and public.is_household_member(instance.earning_household_id)
  )
);
