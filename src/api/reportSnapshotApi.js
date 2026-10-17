import { supabase } from './apiClient'

const table = () => supabase.from('work_report_snapshots')

export async function listSavedWorkReports(startDate, endDate) {
  const { data, error } = await table()
    .select('id, title, start_date, end_date, ai_model, ai_generated_at, created_at')
    .eq('start_date', startDate)
    .eq('end_date', endDate)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw new Error(`讀取歷史報告失敗：${error.message}`)
  return data || []
}

export async function saveWorkReportSnapshot(payload) {
  const { data, error } = await table().insert(payload)
    .select('id, title, start_date, end_date, created_at').single()
  if (error) throw new Error(`儲存工作報告失敗：${error.message}`)
  return data
}

export async function getSavedWorkReport(id) {
  const { data, error } = await table().select('*').eq('id', id).single()
  if (error) throw new Error(`載入工作報告失敗：${error.message}`)
  return data
}

// 報告紀錄頁不受日期區間限制；RLS 確保只看得到自己的報告。
export async function listAllSavedWorkReports() {
  const { data, error } = await table()
    .select('id, title, start_date, end_date, ai_model, ai_generated_at, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(`讀取報告紀錄失敗：${error.message}`)
  return data || []
}

// 使用日期範圍交集搜尋已儲存報告，而不是一次載入所有報告。
export async function listSavedWorkReportsByRange(startDate, endDate) {
  const { data, error } = await table()
    .select('id, title, start_date, end_date, ai_model, ai_generated_at, created_at')
    .lte('start_date', endDate)
    .gte('end_date', startDate)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(`搜尋報告紀錄失敗：${error.message}`)
  return data || []
}

// 僅刪除指定 ID 的單一報告快照；由 RLS 限制只能刪除自己的資料。
export async function deleteSavedWorkReportSnapshot(id) {
  if (!id || typeof id !== 'string') throw new Error('請先選擇要刪除的報告。')
  const { data, error } = await table().delete().eq('id', id).select('id')
  if (error) throw new Error(`刪除工作報告失敗：${error.message}`)
  if (!data?.some(item => item.id === id)) throw new Error('報告不存在或沒有刪除權限，請重新搜尋。')
  return true
}
