import { supabase } from './apiClient'

/** 以目前登入者的 Session 呼叫已部署的 Supabase Edge Function。 */
export async function generateWorkReport(startDate, endDate) {
  const { data, error } = await supabase.functions.invoke('generate-work-report', {
    body: { startDate, endDate },
  })

  if (error) {
    let message = 'AI 摘要產生失敗，請稍後重試。'
    // 非 2xx 的詳細錯誤訊息會放在 FunctionsHttpError.context (Response) 中。
    try {
      if (error.context && typeof error.context.json === 'function') {
        const response = await error.context.json()
        if (typeof response?.error === 'string') message = response.error
      }
    } catch { /* 保留預設訊息 */ }
    throw new Error(message)
  }
  if (!data?.report || typeof data.report.overview !== 'string' || !Array.isArray(data.report.projectHighlights) || !Array.isArray(data.report.decisions) || !Array.isArray(data.report.followUps)) {
    throw new Error('AI 沒有回傳可用的摘要，請重新產生。')
  }
  return data
}
