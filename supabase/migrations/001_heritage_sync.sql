-- Apply once in a new Supabase project. Membership is granted by the project
-- administrator only; the public website cannot register or approve editors.
begin;

create table public.heritage_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.heritage_members enable row level security;
revoke all on public.heritage_members from anon, authenticated;
grant select on public.heritage_members to authenticated;
create policy "read own membership" on public.heritage_members for select to authenticated using (user_id = (select auth.uid()));

create table public.heritage_records (
  user_id uuid not null references public.heritage_members(user_id) on delete cascade,
  record_key text not null check (length(record_key) between 1 and 500),
  value text not null check (length(value) <= 200),
  updated_at timestamptz not null default now(),
  primary key (user_id, record_key)
);
alter table public.heritage_records enable row level security;
revoke all on public.heritage_records from anon, authenticated;
grant select, insert, update on public.heritage_records to authenticated;
create policy "own records" on public.heritage_records for all to authenticated
using (user_id = (select auth.uid()) and exists (select 1 from public.heritage_members where user_id = (select auth.uid())))
with check (user_id = (select auth.uid()) and exists (select 1 from public.heritage_members where user_id = (select auth.uid())));

create table public.heritage_photos (
  id uuid primary key,
  user_id uuid not null references public.heritage_members(user_id) on delete cascade,
  point_key text not null check (length(point_key) between 1 and 450),
  storage_path text not null unique check (storage_path like user_id::text || '/%'),
  filename text not null check (length(filename) between 1 and 250),
  created_at timestamptz not null default now()
);
create index heritage_photos_owner on public.heritage_photos(user_id, id);
alter table public.heritage_photos enable row level security;
revoke all on public.heritage_photos from anon, authenticated;
grant select, insert on public.heritage_photos to authenticated;
create policy "own photos" on public.heritage_photos for all to authenticated
using (user_id = (select auth.uid()) and exists (select 1 from public.heritage_members where user_id = (select auth.uid())))
with check (user_id = (select auth.uid()) and exists (select 1 from public.heritage_members where user_id = (select auth.uid())));

create function public.heritage_touch_record() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger heritage_record_updated before update on public.heritage_records for each row execute function public.heritage_touch_record();

-- Uploading evidence and marking the corresponding point visited commit together.
create function public.heritage_photo_visit() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.heritage_records (user_id, record_key, value)
  values (new.user_id, new.point_key || '::visit', 'auto')
  on conflict (user_id, record_key) do update set value = 'auto', updated_at = now();
  return new;
end;
$$;
create trigger heritage_uploaded_visit after insert on public.heritage_photos for each row execute function public.heritage_photo_visit();
revoke all on function public.heritage_touch_record() from public;
revoke all on function public.heritage_photo_visit() from public;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('heritage-photos', 'heritage-photos', false, 10485760, array['image/jpeg','image/png','image/webp']);
create policy "owner photo read" on storage.objects for select to authenticated
using (bucket_id = 'heritage-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.heritage_members where user_id = (select auth.uid())));
create policy "owner photo upload" on storage.objects for insert to authenticated
with check (bucket_id = 'heritage-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.heritage_members where user_id = (select auth.uid())));
create policy "owner failed upload cleanup" on storage.objects for delete to authenticated
using (bucket_id = 'heritage-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.heritage_members where user_id = (select auth.uid())));
commit;
