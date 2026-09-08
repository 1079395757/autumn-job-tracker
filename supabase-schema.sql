-- 在 Supabase Dashboard -> SQL Editor 中运行此脚本。
-- 它只创建秋招投递表、更新时间触发器和当前用户的数据访问策略。

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  role text not null,
  location text not null default '',
  salary text not null default '',
  channel text not null default '官网',
  job_type text not null default '校招',
  job_link text not null default '',
  fair_name text not null default '',
  fair_date date,
  fair_time time,
  fair_venue text not null default '',
  status text not null default '关注中',
  applied_date date,
  deadline date,
  next_date date,
  next_time time,
  node_type text not null default '其他节点',
  next_action text not null default '',
  description text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_user_id_idx on public.jobs(user_id);
create index if not exists jobs_user_next_date_idx on public.jobs(user_id, next_date);
create index if not exists jobs_user_fair_date_idx on public.jobs(user_id, fair_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

alter table public.jobs enable row level security;

-- RLS 决定用户能操作哪些行，GRANT 决定登录用户是否可以调用这些操作。
grant usage on schema public to anon, authenticated;
grant select on table public.jobs to anon;
grant select, insert, update, delete on table public.jobs to authenticated;

drop policy if exists "Users can view their own jobs" on public.jobs;
create policy "Users can view their own jobs"
on public.jobs for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own jobs" on public.jobs;
create policy "Users can insert their own jobs"
on public.jobs for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own jobs" on public.jobs;
create policy "Users can update their own jobs"
on public.jobs for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own jobs" on public.jobs;
create policy "Users can delete their own jobs"
on public.jobs for delete
to authenticated
using ((select auth.uid()) = user_id);
