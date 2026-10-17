-- 只允許登入者刪除自己建立的報告快照。
-- 不修改 work_logs、categories、day_statuses。
grant delete on table public.work_report_snapshots to authenticated;
create policy "report_snapshots_delete_own"
on public.work_report_snapshots
for delete to authenticated
using (owner_id = (select auth.uid()));
