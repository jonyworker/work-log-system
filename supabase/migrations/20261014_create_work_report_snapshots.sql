-- Phase 4: 按使用者隔離的不可覆寫工作報告快照
create table if not exists public.work_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  title text not null default '工作報告',
  report jsonb not null,
  stats jsonb not null,
  details jsonb not null default '[]'::jsonb,
  ai_model text,
  ai_usage jsonb,
  ai_generated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint work_report_dates_valid check (end_date >= start_date and end_date - start_date <= 366),
  constraint work_report_json_type check (jsonb_typeof(report) = 'object'),
  constraint work_report_stats_type check (jsonb_typeof(stats) = 'object'),
  constraint work_report_details_type check (jsonb_typeof(details) = 'array'),
  constraint work_report_title_length check (char_length(title) between 1 and 160)
);
create index if not exists work_report_snapshots_owner_period_idx
  on public.work_report_snapshots(owner_id, start_date, end_date, created_at desc);
alter table public.work_report_snapshots enable row level security;
create policy "report_snapshots_select_own" on public.work_report_snapshots
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "report_snapshots_insert_own" on public.work_report_snapshots
  for insert to authenticated with check (owner_id = (select auth.uid()));
grant select, insert on public.work_report_snapshots to authenticated;
revoke all on public.work_report_snapshots from anon;
