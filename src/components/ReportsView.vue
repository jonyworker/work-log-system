<script setup>
import { computed, ref, watch } from 'vue'
import { fetchWorkLogs } from '../api/workLogApi'
import { generateWorkReport } from '../api/reportAiApi'
import { saveWorkReportSnapshot } from '../api/reportSnapshotApi'
import { useCategoryStore } from '../stores/categoryStore'

const categoryStore = useCategoryStore()
const dateString = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
const today = new Date()
const startDate = ref(dateString(new Date(today.getFullYear(), today.getMonth(), 1)))
const endDate = ref(dateString(today))
const selectedCategory = ref('all')
const periodMode = ref('month')
const loadedPeriod = ref({start: '', end: ''})
const rows = ref([])
const loading = ref(false)
const error = ref('')
const fetched = ref(false)
const stale = ref(false)
// AI 內容僅保留於目前頁面，不會覆寫原始 work_logs。
const aiReport = ref(null)
const aiLoading = ref(false)
const aiError = ref('')
const aiUsage = ref(null)
const aiModel = ref('')
const aiPeriod = ref(null)
const aiGeneratedAt = ref('')
const snapshotsError = ref('')
const snapshotSaving = ref(false)
// 報告名稱預設由查詢區間產生，使用者仍可直接修改。
const formatReportTitle = (start, end) => start && end
  ? `${start.replaceAll('-', '/')} - ${end.replaceAll('-', '/')} 工作報告`
  : '工作報告'
const reportTitle = ref(formatReportTitle(startDate.value, endDate.value))
watch([startDate, endDate], ([start, end]) => {
  reportTitle.value = formatReportTitle(start, end)
})
const snapshotNotice = ref('')
const savedReportLabel = '目前查詢資料'
function snapshotStats() {
  return {
    totalHours: allHours.value,
    workHours: workHours.value,
    overtimeHours: overtimeHours.value,
    workDays: workDays.value,
    recordCount: filtered.value.length,
    projectStats: JSON.parse(JSON.stringify(projectStats.value)),
    categoryStats: JSON.parse(JSON.stringify(categoryStats.value)),
  }
}
async function saveSnapshot() {
  if (!fetched.value || !aiReport.value || aiLoading.value || snapshotSaving.value || stale.value || selectedCategory.value !== 'all') return
  const name = reportTitle.value.trim()
  if (!name || name.length > 160) {
    snapshotsError.value = '報告名稱需為 1～160 字。'
    return
  }
  snapshotsError.value = ''
  snapshotNotice.value = ''
  snapshotSaving.value = true
  try {
    await saveWorkReportSnapshot({
      start_date: loadedPeriod.value.start,
      end_date: loadedPeriod.value.end,
      title: name,
      report: JSON.parse(JSON.stringify(aiReport.value)),
      stats: snapshotStats(),
      details: JSON.parse(JSON.stringify(filtered.value)),
      ai_model: aiModel.value || null,
      ai_usage: aiUsage.value || null,
      ai_generated_at: aiPeriod.value ? new Date().toISOString() : null,
    })
    snapshotNotice.value = '報告已儲存。可前往左側「報告紀錄」查閱及編輯。'
  } catch (err) {
    snapshotsError.value = err?.message || '儲存失敗，請稍後再試。'
  } finally {
    snapshotSaving.value = false
  }
}
let aiRequestSequence = 0
function resetAi() {
  ++aiRequestSequence
  aiReport.value = null
  aiUsage.value = null
  aiModel.value = ''
  aiPeriod.value = null
  aiGeneratedAt.value = ''
  aiError.value = ''
  aiLoading.value = false
}
const aiAvailable = computed(() => fetched.value && !stale.value && !loading.value && !aiLoading.value &&
  filtered.value.length > 0 && selectedCategory.value === 'all')
const aiTokenCount = computed(() => aiUsage.value?.total_tokens ?? null)
const aiApproxCost = computed(() => {
  // 僅對預設 gpt-5-mini 估價，其他模型不猜測費率。
  if (!aiModel.value.startsWith('gpt-5-mini') || !aiUsage.value) return null
  const input = Number(aiUsage.value.input_tokens || 0)
  const output = Number(aiUsage.value.output_tokens || 0)
  return (input * 0.25 + output * 2) / 1000000
})
async function createAiSummary() {
  if (!aiAvailable.value) return
  const seq = ++aiRequestSequence
  const period = { ...loadedPeriod.value }
  aiLoading.value = true
  aiError.value = ''
  try {
    const result = await generateWorkReport(period.start, period.end)
    if (seq !== aiRequestSequence) return
    aiReport.value = result.report
    aiUsage.value = result.usage ?? null
    aiModel.value = result.model ?? ''
    aiPeriod.value = period
    aiGeneratedAt.value = new Date().toLocaleString('zh-TW', {hour12:false})
    snapshotNotice.value = ''
  } catch (err) {
    if (seq !== aiRequestSequence) return
    aiError.value = err?.message || 'AI 產生摘要時發生錯誤。'
  } finally {
    if (seq === aiRequestSequence) aiLoading.value = false
  }
}
function handleCategoryChange() { resetAi(); snapshotNotice.value = ''; snapshotsError.value = '' }

let requestSequence = 0
const formatHours = (value) => `${Math.round((Number(value)||0)*100)/100}h`
const totalHours = (items) => items.reduce((sum,item) => sum + (Number(item.hours)||0),0)
const filtered = computed(() => rows.value.filter(item => selectedCategory.value === 'all' || (item.category || '') === selectedCategory.value))
const regular = computed(() => filtered.value.filter(item => item.type !== 'overtime'))
const overtime = computed(() => filtered.value.filter(item => item.type === 'overtime'))
const workHours = computed(() => totalHours(regular.value))
const overtimeHours = computed(() => totalHours(overtime.value))
const allHours = computed(() => workHours.value + overtimeHours.value)
const workDays = computed(() => new Set(filtered.value.map(item => item.date)).size)
// 專案目前存在 content 開頭的 [名稱]／【名稱】，不修改既有 Supabase 結構。
function splitContent(text) {
  const str = String(text || '')
  const match = str.match(/^\s*[\[［【]\s*([^\]］】]+?)\s*[\]］】]\s*(?:[-－–—：:]\s*)?([\s\S]*)$/)
  return match ? { subject: match[1].trim(), detail: match[2].trim() } : { subject: '', detail: str }
}
function projectOf(item) {
  return splitContent(item.content).subject || '未分類專案'
}
function summarizeBy(getName) {
  const stats = new Map()
  for (const item of filtered.value) {
    const name = getName(item)
    if (!stats.has(name)) stats.set(name, { name, hours: 0, work: 0, overtime: 0, count: 0 })
    const stat = stats.get(name)
    const hours = Number(item.hours) || 0
    stat.hours += hours
    if (item.type === 'overtime') stat.overtime += hours
    else stat.work += hours
    stat.count++
  }
  return [...stats.values()].sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name, 'zh-TW'))
}
const projectStats = computed(() => summarizeBy(projectOf))
const categoryStats = computed(() => summarizeBy(item => item.category || '未分類'))
const projectCount = computed(() => projectStats.value.filter(item => item.name !== '未分類專案').length)
const percent = (hours) => allHours.value > 0 ? Math.min(100, Math.max(0, hours / allHours.value * 100)) : 0
const formatPercent = (hours) => `${Math.round(percent(hours) * 10) / 10}%`
const grouped = computed(() => {
  const days = new Map()
  for (const item of [...filtered.value].sort((a,b)=>b.date.localeCompare(a.date) || (Number(a.sortOrder)||0)-(Number(b.sortOrder)||0))) {
    if (!days.has(item.date)) days.set(item.date,[])
    days.get(item.date).push(item)
  }
  return [...days].map(([date,items])=>({date,items,hours:totalHours(items)}))
})
const categoryNames = computed(() => [...new Set([...categoryStore.activeCategories.map(x=>x.name),...rows.value.map(x=>x.category).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'zh-TW')))
function categoryStyle(name) {
  const category = categoryStore.getCategory(name)
  return {backgroundColor:category?.bgColor || '#edf2f7',color:category?.textColor || '#48576b'}
}
// 以目前選取的日期作為切換基準，避免每次點擊都跳回今天。
// 採週一至週日為一週，月份使用完整的第一日至最後一日。
function getPeriodBounds(mode, anchor) {
  const date = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
  if (mode === 'day') {
    const value = dateString(date)
    return { start: value, end: value }
  }
  if (mode === 'week') {
    const diff = (date.getDay() + 6) % 7
    const first = new Date(date.getFullYear(), date.getMonth(), date.getDate() - diff)
    const last = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 6)
    return { start: dateString(first), end: dateString(last) }
  }
  return {
    start: dateString(new Date(date.getFullYear(), date.getMonth(), 1)),
    end: dateString(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  }
}
function selectPeriod(mode) {
  periodMode.value = mode
  const current = startDate.value ? new Date(`${startDate.value}T12:00:00`) : new Date()
  const anchor = Number.isNaN(current.getTime()) ? new Date() : current
  const next = getPeriodBounds(mode, anchor)
  startDate.value = next.start
  endDate.value = next.end
  clearCurrentReport()
}
function stepPeriod(direction) {
  const current = startDate.value ? new Date(`${startDate.value}T12:00:00`) : new Date()
  const anchor = Number.isNaN(current.getTime()) ? new Date() : current
  if (periodMode.value === 'day') anchor.setDate(anchor.getDate() + direction)
  else if (periodMode.value === 'week') anchor.setDate(anchor.getDate() + direction * 7)
  else anchor.setMonth(anchor.getMonth() + direction)
  const next = getPeriodBounds(periodMode.value, anchor)
  startDate.value = next.start
  endDate.value = next.end
  clearCurrentReport()
}
const periodModeName = computed(() => ({ day: '日', week: '週', month: '月' })[periodMode.value])
async function search() {
  error.value = ''
  if (!startDate.value || !endDate.value || startDate.value > endDate.value) {
    error.value = '請選擇有效的日期區間。'
    return
  }
  const diff = (new Date(`${endDate.value}T12:00:00`) - new Date(`${startDate.value}T12:00:00`))/86400000
  if (diff > 366) {error.value = '一次最多查詢 367 天，請縮短日期區間。';return}
  const seq = ++requestSequence
  loading.value = true
  try {
    const result = await fetchWorkLogs(startDate.value,endDate.value)
    if (seq !== requestSequence) return
    resetAi()
    snapshotNotice.value = ''
    snapshotsError.value = ''
    rows.value = result
    fetched.value = true
    loadedPeriod.value = {start: startDate.value, end: endDate.value}
    stale.value = false
  } catch (err) {
    if (seq !== requestSequence) return
    error.value = err?.message || '無法取得工作紀錄，請稍後重試。'
    stale.value = true
  } finally {
    if (seq === requestSequence) loading.value = false
  }
}
function clearCurrentReport() {
  // 搜尋條件變動後先隱藏舊結果，避免誤認為是新區間的報告。
  ++requestSequence
  fetched.value = false
  rows.value = []
  loadedPeriod.value = { start: '', end: '' }
  stale.value = false
  loading.value = false
  error.value = ''
  resetAi()
  snapshotNotice.value = ''
  snapshotsError.value = ''
}
function handleDateChange() { clearCurrentReport() }
function formatDate(value) {
  const [y,m,d] = value.split('-')
  return `${y}/${m}/${d}`
}
// 首次進入不自動搜尋；由使用者按「產生報告」才載入資料。
</script>

<template>
  <div class="wl-report">
    <header class="wl-report-header">
      <div><p class="wl-report-eyebrow">REPORTS / WORK ANALYSIS</p><h1>工作報告</h1><p>用數據回顧工作分布，並保留完整的每日工作內容。</p></div>
      <span class="wl-report-phase">PHASE 4 · 工作報告產生</span>
    </header>

    <section class="wl-report-panel wl-report-filters" aria-label="報告查詢條件">
      <div class="wl-report-period-controls">
        <div class="wl-report-periods" role="group" aria-label="報告日期模式">
          <button v-for="mode in [{ key: 'day', label: '日' }, { key: 'week', label: '週' }, { key: 'month', label: '月' }]"
                  :key="mode.key" type="button"
                  :class="{ 'is-active': periodMode === mode.key }"
                  :aria-pressed="periodMode === mode.key"
                  @click="selectPeriod(mode.key)">{{ mode.label }}</button>
        </div>
        <div class="wl-report-period-navigation" role="group" aria-label="切換查詢期間">
          <button type="button" @click="stepPeriod(-1)">← 上一{{ periodModeName }}</button>
          <button type="button" @click="stepPeriod(1)">下一{{ periodModeName }} →</button>
        </div>
      </div>
      <label>開始日期<input v-model="startDate" type="date" @change="handleDateChange" /></label>
      <label>結束日期<input v-model="endDate" type="date" @change="handleDateChange" /></label>
      <label>工作分類<select v-model="selectedCategory" @change="handleCategoryChange"><option value="all">全部分類</option><option v-for="name in categoryNames" :key="name" :value="name">{{ name }}</option></select></label>
      <button type="button" class="wl-report-search" :disabled="loading" @click="search">{{ loading ? '查詢中…' : '產生報告' }}</button>
    </section>
    <p v-if="error" class="wl-report-error" role="alert">{{ error }}</p>
    <p v-if="stale && fetched" class="wl-report-notice">日期已變更，請按「產生報告」更新下方資料。</p>
    <div v-if="loading && !fetched" class="wl-report-panel wl-report-empty">正在整理工作紀錄…</div>
    <section v-else-if="!fetched" class="wl-report-panel wl-report-initial-summary" aria-label="工作摘要">
      <div class="wl-report-section-heading">
        <div><p class="wl-report-eyebrow">02 / SUMMARY</p><h2>工作摘要</h2></div>
      </div>
      <div class="wl-report-initial-content" role="status">
        <strong>尚未搜尋工作報告</strong>
        <p>請先選擇日期區間，點擊上方「產生報告」，即可查看工時總覽、工作摘要與工作明細。</p>
      </div>
    </section>
    <template v-else-if="fetched">
      <section class="wl-report-panel" aria-label="工時總覽">
        <div class="wl-report-section-heading"><div><p class="wl-report-eyebrow">01 / OVERVIEW</p><h2>工時總覽</h2></div><span>{{ formatDate(loadedPeriod.start) }} 至 {{ formatDate(loadedPeriod.end) }}</span></div>
        <div class="wl-report-kpis">
          <div><span>總工時</span><strong>{{ formatHours(allHours) }}</strong></div>
          <div><span>一般工作</span><strong>{{ formatHours(workHours) }}</strong></div>
          <div><span>加班工時</span><strong>{{ formatHours(overtimeHours) }}</strong></div>
          <div><span>有紀錄天數</span><strong>{{ workDays }}<small>天</small></strong></div>
          <div><span>工作筆數</span><strong>{{ filtered.length }}<small>筆</small></strong></div>
        </div>
      </section>
      <section class="wl-report-panel" aria-label="工作摘要">
        <div class="wl-report-section-heading wl-report-summary-heading">
          <div><p class="wl-report-eyebrow">02 / SUMMARY</p><h2>工作摘要</h2></div>
          <div class="wl-report-summary-save-actions">
            <label class="wl-report-title-field" for="wl-report-title">
              <span>報告名稱</span>
              <input id="wl-report-title" v-model="reportTitle" maxlength="160" placeholder="請輸入報告名稱" autocomplete="off" />
            </label>
            <button type="button" class="wl-report-search wl-report-save-header" :disabled="!aiReport || snapshotSaving || aiLoading || stale || selectedCategory !== 'all' || !reportTitle.trim()" :title="!aiReport ? '請先產生 AI 摘要後再儲存' : '儲存工作報告'" @click="saveSnapshot">{{ snapshotSaving ? '儲存中…' : '儲存報告' }}</button>
          </div>
        </div>
        <p v-if="!filtered.length" class="wl-report-muted">目前沒有可整理的工作內容。</p>
        <template v-else>
          <p class="wl-report-summary">本期間共記錄 {{ filtered.length }} 筆工作，涵蓋 {{ workDays }} 個日期、{{ projectCount }} 個可辨識專案，累計 {{ formatHours(allHours) }}，其中一般工時 {{ formatHours(workHours) }}、加班 {{ formatHours(overtimeHours) }}。</p>
          <div class="wl-report-ai">
            <div class="wl-report-ai-toolbar">
              <div><strong>AI 工作成果整理</strong><p class="wl-report-muted">依原始工作紀錄生成繁體中文摘要；如需修改請先儲存，再至「報告紀錄」編輯。</p></div>
              <div class="wl-report-ai-actions">
                <button type="button" class="wl-report-ai-generate" :disabled="!aiAvailable" @click="createAiSummary">{{ aiLoading ? 'AI 整理中…' : aiReport ? '重新生成摘要' : 'AI 產生摘要' }}</button>
              </div>
            </div>
            <p v-if="selectedCategory !== 'all'" class="wl-report-notice">目前 AI 只支援「全部分類」的日期區間摘要。請切回全部分類後生成，避免摘要與統計範圍不一致。</p>
            <p v-if="stale" class="wl-report-notice">日期尚未重新查詢，請先按「產生報告」。</p>
            <p v-if="aiError" class="wl-report-error" role="alert">{{ aiError }}</p>
            <p v-if="aiLoading" class="wl-report-muted" role="status">正在依據工作紀錄整理成果，請稍候…</p>
            <div v-if="aiReport" class="wl-report-ai-sections">
              <section class="wl-report-ai-section">
                <h3>01 / 本期工作概況</h3>
                <p class="wl-report-ai-output">{{ aiReport.overview }}</p>
              </section>
              <section class="wl-report-ai-section">
                <h3>02 / 各專案工作成果</h3>
                <div v-for="(item, index) in aiReport.projectHighlights" :key="index" class="wl-report-ai-entry">
                  <h4>{{ item.project }}</h4><p>{{ item.result }}</p>
                </div>
                <p v-if="!aiReport.projectHighlights.length" class="wl-report-muted">本期無可確認的專案成果。</p>
              </section>
              <section class="wl-report-ai-section">
                <h3>03 / 重要決議</h3>
                <div v-for="(item, index) in aiReport.decisions" :key="index" class="wl-report-ai-entry">
                  <p>{{ item }}</p>
                </div>
                <p v-if="!aiReport.decisions.length" class="wl-report-muted">原始紀錄未提及明確決議。</p>
              </section>
              <section class="wl-report-ai-section">
                <h3>04 / 待追蹤事項</h3>
                <div v-for="(item, index) in aiReport.followUps" :key="index" class="wl-report-ai-entry">
                  <h4>{{ item.task }} <span v-if="item.dueDate" class="wl-report-ai-due">{{ item.dueDate }}</span></h4>
                  <p>{{ item.nextStep }}</p>
                </div>
                <p v-if="!aiReport.followUps.length" class="wl-report-muted">原始紀錄未提及待追蹤事項。</p>
              </section>
            </div>
            <p v-else-if="!aiLoading" class="wl-report-muted">尚未產生 AI 摘要。點選「AI 產生摘要」後才會呼叫 OpenAI API，並產生費用。</p>
            <div v-if="aiReport" class="wl-report-ai-meta">
              <span>生成時間：{{ aiGeneratedAt }}</span>
              <span v-if="aiTokenCount !== null">Token 用量：{{ aiTokenCount.toLocaleString() }}</span>
              <span v-if="aiApproxCost !== null">估計費用：US${{ aiApproxCost.toFixed(5) }}</span>
            </div>
            <div v-if="snapshotNotice || snapshotsError" class="wl-report-save-feedback" aria-live="polite">
              <p v-if="snapshotNotice" class="wl-report-snapshot-info" role="status">{{ snapshotNotice }}</p>
              <p v-if="snapshotsError" class="wl-report-error" role="alert">{{ snapshotsError }}</p>
            </div>
          </div>
        </template>
      </section>
      <details class="wl-report-panel wl-report-collapsible" aria-label="專案工時統計">
        <summary class="wl-report-collapse-heading">
          <span class="wl-report-collapse-title"><span class="wl-report-eyebrow">03 / PROJECT BREAKDOWN</span><span class="wl-report-collapse-name">各專案工時</span></span>
          <span class="wl-report-collapse-meta">{{ projectCount }} 個專案 · {{ formatHours(allHours) }}</span>
          <svg class="wl-report-chevron" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </summary>
        <div class="wl-report-collapse-content">
        <div v-if="!projectStats.length" class="wl-report-empty">這個區間沒有符合條件的工作紀錄。</div>
        <div v-for="item in projectStats" :key="item.name" class="wl-report-breakdown">
          <div class="wl-report-breakdown-head">
            <strong class="wl-report-project-name">{{ item.name }}</strong>
            <span class="wl-report-breakdown-meta">{{ item.count }} 筆 · 一般 {{ formatHours(item.work) }} · 加班 {{ formatHours(item.overtime) }}</span>
            <strong>{{ formatHours(item.hours) }} <small>({{ formatPercent(item.hours) }})</small></strong>
          </div>
          <div class="wl-report-track"><div :style="{width: `${percent(item.hours)}%`}"></div></div>
        </div>
        <p v-if="projectStats.some(item => item.name === '未分類專案')" class="wl-report-muted wl-report-footnote">「未分類專案」表示該筆紀錄沒有可辨識的專案名稱，不影響工時總計。</p>
        </div>
      </details>
      <details class="wl-report-panel wl-report-collapsible" aria-label="工作分類工時統計">
        <summary class="wl-report-collapse-heading">
          <span class="wl-report-collapse-title"><span class="wl-report-eyebrow">04 / CATEGORY BREAKDOWN</span><span class="wl-report-collapse-name">各工作分類工時</span></span>
          <span class="wl-report-collapse-meta">{{ categoryStats.length }} 種分類 · {{ formatHours(allHours) }}</span>
          <svg class="wl-report-chevron" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </summary>
        <div class="wl-report-collapse-content">
        <div v-if="!categoryStats.length" class="wl-report-empty">這個區間沒有符合條件的工作紀錄。</div>
        <div v-for="item in categoryStats" :key="item.name" class="wl-report-breakdown">
          <div class="wl-report-breakdown-head">
            <span class="wl-report-category" :style="categoryStyle(item.name)">{{ item.name }}</span>
            <span class="wl-report-breakdown-meta">{{ item.count }} 筆 · 一般 {{ formatHours(item.work) }} · 加班 {{ formatHours(item.overtime) }}</span>
            <strong>{{ formatHours(item.hours) }} <small>({{ formatPercent(item.hours) }})</small></strong>
          </div>
          <div class="wl-report-track wl-report-track-category"><div :style="{width: `${percent(item.hours)}%`}"></div></div>
        </div>
        </div>
      </details>
      <details class="wl-report-panel wl-report-collapsible" aria-label="每日工作明細">
        <summary class="wl-report-collapse-heading">
          <span class="wl-report-collapse-title"><span class="wl-report-eyebrow">05 / WORK LOG DETAILS</span><span class="wl-report-collapse-name">每日工作明細</span></span>
          <span class="wl-report-collapse-meta">{{ grouped.length }} 天 · {{ filtered.length }} 筆</span>
          <svg class="wl-report-chevron" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </summary>
        <div class="wl-report-collapse-content">
        <div v-if="!grouped.length" class="wl-report-empty">無工作明細</div>
        <div v-for="day in grouped" :key="day.date" class="wl-report-day">
          <div class="wl-report-day-head"><strong>{{ formatDate(day.date) }}</strong><span>當日 {{ formatHours(day.hours) }}</span></div>
          <div v-for="entry in day.items" :key="entry.id" class="wl-report-entry">
            <div class="wl-report-entry-head"><span class="wl-report-category" :style="categoryStyle(entry.category)">{{ entry.category || '未分類' }}</span><span v-if="entry.type === 'overtime'" class="wl-report-overtime">加班</span><strong>{{ formatHours(entry.hours) }}</strong></div>
            <strong class="wl-report-entry-subject">{{ projectOf(entry) }}</strong>
            <p>{{ splitContent(entry.content).detail || '未填寫工作內容' }}</p>
          </div>
        </div>
        </div>
      </details>
    </template>
  </div>
</template>

<style scoped>
.wl-report{display:grid;gap:20px;color:#1f2b3e;min-width:0}
.wl-report-header,.wl-report-section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap}
.wl-report-header{padding:5px 4px 2px}
.wl-report-eyebrow{font-size:11px;font-weight:700;letter-spacing:.085em;color:#627a9c;margin:0 0 6px}
.wl-report-header h1{font-size:28px;font-weight:750;line-height:1.3;margin:0}
.wl-report-header p:last-child{font-size:13px;color:#61738d;margin-top:7px}
.wl-report-phase{font-size:11px;font-weight:650;color:#536681;background:#ebf1f8;border-radius:8px;padding:8px 11px}
.wl-report-panel{background:#fff;border:1px solid #dfe6ef;border-radius:16px;padding:23px;box-shadow:0 1px 2px #182c4a0b;min-width:0}
.wl-report-collapsible{padding:0;overflow:hidden}
.wl-report-collapse-heading{display:flex;align-items:center;gap:18px;padding:23px;cursor:pointer;list-style:none;user-select:none}
.wl-report-collapse-heading::-webkit-details-marker{display:none}
.wl-report-collapse-heading::marker{content:""}
.wl-report-collapse-heading:hover{background:#f9fbfd}
.wl-report-collapse-heading:focus-visible{outline:2px solid #6689bd;outline-offset:-3px;border-radius:16px}
.wl-report-collapse-title{display:grid;gap:4px;flex:1;min-width:0}
.wl-report-collapse-title .wl-report-eyebrow{margin:0}
.wl-report-collapse-name{font-size:19px;font-weight:730;line-height:1.35}
.wl-report-collapse-meta{font-size:12px;color:#8795a8;text-align:right}
.wl-report-chevron{flex-shrink:0;color:#6f839f;transition:transform .2s ease}
.wl-report-collapsible[open] .wl-report-chevron{transform:rotate(180deg)}
.wl-report-collapse-content{padding:0 23px 23px;border-top:1px solid #e5ebf2}
.wl-report-collapse-content>.wl-report-breakdown:first-of-type{margin-top:21px}
.wl-report-collapse-content>.wl-report-day:first-of-type{margin-top:21px}
.wl-report-filters{display:flex;gap:13px;align-items:end;flex-wrap:wrap}
.wl-report-filters label{display:grid;gap:7px;font-size:12px;font-weight:650;color:#5e728d;min-width:140px;flex:1}
.wl-report-filters input,.wl-report-filters select{border:1px solid #d5deea;border-radius:9px;padding:10px 11px;background:#fff;color:#223149;min-height:42px;max-width:100%;font-size:13px}
.wl-report-period-controls{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.wl-report-periods{display:flex;gap:4px;padding:4px;background:#f1f4f8;border-radius:10px}
.wl-report-periods button{border:0;background:transparent;border-radius:7px;padding:9px 12px;font-size:13px;color:#425773;cursor:pointer}
.wl-report-periods button:hover{background:#fff}
.wl-report-periods button.is-active{background:#fff;color:#1f2b3e;font-weight:750;box-shadow:0 1px 4px #172c4820}
.wl-report-period-navigation{display:flex;gap:7px}
.wl-report-period-navigation button{border:1px solid #d5deea;background:#fff;color:#334968;border-radius:9px;min-height:42px;padding:8px 10px;font-size:12px;white-space:nowrap;cursor:pointer}
.wl-report-period-navigation button:hover{background:#f5f8fc;border-color:#9fb1cd}
.wl-report-search{background:#25354d;color:#fff;border:0;border-radius:9px;padding:11px 17px;min-height:42px;font-size:13px;font-weight:650;cursor:pointer}
.wl-report-search:disabled{opacity:.55;cursor:wait}
.wl-report-section-heading{align-items:end;padding-bottom:19px;border-bottom:1px solid #e5ebf2;margin-bottom:21px}
.wl-report-section-heading h2{font-size:19px;font-weight:730;margin:0}
.wl-report-section-heading>span{font-size:12px;color:#8795a8}
.wl-report-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0}
.wl-report-kpis>div{display:flex;flex-direction:column;gap:13px;padding:5px 20px;border-left:1px solid #e5ebf2}
.wl-report-kpis>div:first-child{padding-left:0;border-left:0}
.wl-report-kpis span{font-size:12px;color:#71839b}
.wl-report-kpis strong{font-size:25px;font-weight:750;letter-spacing:-.03em}
.wl-report-kpis small{font-size:12px;margin-left:4px;color:#75869d}
.wl-report-breakdown{margin:17px 0}
.wl-report-breakdown-head{display:flex;align-items:center;gap:12px;font-size:12px;color:#72839a;flex-wrap:wrap;margin-bottom:9px}
.wl-report-breakdown-head>span:nth-child(2){flex:1}
.wl-report-breakdown-head>strong{font-size:14px;color:#2c3c53}
.wl-report-breakdown-head>strong small{font-size:11px;font-weight:500;color:#7c899a}
.wl-report-breakdown-head .wl-report-project-name{min-width:110px;overflow-wrap:anywhere}
.wl-report-breakdown-meta{flex:1}
.wl-report-footnote{margin:15px 0 0}
.wl-report-track-category>div{background:#9babc0}
.wl-report-category{display:inline-flex;align-items:center;border-radius:7px;padding:4px 9px;font-size:11px;font-weight:700;line-height:1.45}
.wl-report-track{height:8px;background:#eef2f6;border-radius:10px;overflow:hidden}
.wl-report-track>div{background:#6d87a8;height:100%;border-radius:10px}
.wl-report-summary{font-size:14px;line-height:1.85;margin:0 0 12px}
.wl-report-muted{font-size:13px;color:#75859a;line-height:1.8}
.wl-report-day{border-bottom:1px solid #e6ecf3;padding:0 0 13px;margin-bottom:20px}
.wl-report-day:last-child{border-bottom:0;margin-bottom:0}
.wl-report-day-head{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#f4f6f9;border-radius:8px;padding:11px 14px;margin-bottom:3px}
.wl-report-day-head strong{font-size:14px}.wl-report-day-head span{font-size:12px;color:#64758b}
.wl-report-entry{padding:15px 14px;border-bottom:1px solid #ecf0f4}
.wl-report-entry:last-child{border-bottom:0}
.wl-report-entry-head{display:flex;gap:9px;align-items:center;margin-bottom:7px}
.wl-report-entry-head strong{margin-left:auto;font-size:13px}.wl-report-overtime{font-size:11px;color:#b15b42}
.wl-report-entry-subject{display:block;font-size:13px;margin:7px 0}
.wl-report-entry p{font-size:13px;color:#52637b;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}
.wl-report-initial-content{text-align:center;padding:48px 16px;color:#40536d}.wl-report-initial-content strong{font-size:16px}.wl-report-initial-content p{font-size:13px;color:#7b8ca3;line-height:1.8;margin:10px auto 0;max-width:460px}
.wl-report-empty{color:#8492a5;text-align:center;padding:30px;font-size:13px}
.wl-report-error,.wl-report-notice{padding:12px 15px;border-radius:9px;font-size:13px;background:#fff1f1;color:#b03737}
.wl-report-notice{background:#fff8e8;color:#8c681d}
.wl-report-ai{margin-top:20px;padding:18px;border:1px solid #e2e9f1;border-radius:12px;background:#fafcff}
.wl-report-ai-toolbar{display:flex;align-items:start;justify-content:space-between;gap:15px;flex-wrap:wrap}
.wl-report-ai-toolbar strong{font-size:14px}
.wl-report-ai-toolbar p{margin:5px 0 0}
.wl-report-ai-actions{display:flex;gap:8px;flex-wrap:wrap}
.wl-report-ai-actions button{border-radius:9px;padding:10px 14px;min-height:38px;font-size:12px;font-weight:650;cursor:pointer}
.wl-report-ai-generate{background:#25354d;border:1px solid #25354d;color:white}
.wl-report-ai-secondary{background:#fff;border:1px solid #ccd7e5;color:#334968}
.wl-report-ai-actions button:disabled{opacity:.48;cursor:not-allowed}
.wl-report-ai-output{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.95;color:#30445e;margin:16px 0}
.wl-report-ai-sections{display:grid;gap:20px;margin-top:18px}.wl-report-ai-section{border-top:1px solid #e2e9f1;padding-top:16px}.wl-report-ai-section h3{font-size:14px;margin:0 0 10px;font-weight:750;color:#263951}.wl-report-ai-entry{padding:10px 0;border-bottom:1px solid #edf0f5}.wl-report-ai-entry:last-child{border-bottom:0}.wl-report-ai-entry h4{margin:0 0 5px;font-size:13px;color:#263951}.wl-report-ai-entry p{white-space:pre-wrap;margin:0;font-size:13px;line-height:1.8;color:#40536d}.wl-report-ai-due{font-weight:500;color:#7d6170;font-size:12px;margin-left:7px}.wl-report-ai-entry label{display:block;font-size:12px;margin:8px 0;color:#627994}.wl-report-ai-input{box-sizing:border-box;width:100%;padding:9px;border:1px solid #c7d4e6;border-radius:8px;font:inherit;color:#30445e}.wl-report-ai-editor{box-sizing:border-box;display:block;width:100%;min-height:85px;margin-top:15px;padding:14px;border:1px solid #c7d4e6;border-radius:9px;resize:vertical;font-family:inherit;font-size:13px;line-height:1.85;color:#30445e}
.wl-report-ai-meta{display:flex;gap:8px 16px;flex-wrap:wrap;font-size:11px;color:#627994;border-top:1px solid #e5ebf2;padding-top:12px;margin-top:15px}
.wl-report-ai-hint{font-size:11px;margin-bottom:0}
.wl-report-summary-heading{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap}
.wl-report-summary-save-actions{display:flex;align-items:end;gap:10px;flex:1;justify-content:flex-end;min-width:0}
.wl-report-title-field{display:grid;gap:5px;min-width:220px;max-width:390px;flex:1;color:#647791;font-size:11px;font-weight:650}
.wl-report-title-field input{box-sizing:border-box;width:100%;min-height:42px;border:1px solid #d5deea;border-radius:9px;padding:9px 12px;background:#fff;color:#25354d;font-family:inherit;font-size:13px}
.wl-report-title-field input:focus-visible{outline:2px solid #7798c7;outline-offset:1px}
.wl-report-save-feedback{margin-top:15px}
.wl-report-save-feedback p{margin:0}
.wl-report-save-header{white-space:nowrap;min-width:96px}.wl-report-save-header:disabled{opacity:.48;cursor:not-allowed}.wl-report-inline-save{display:grid;gap:12px;margin-top:18px;border-top:1px solid #dfe6ef;padding-top:18px}.wl-report-inline-save-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.wl-report-inline-save-head strong{font-size:14px}.wl-report-inline-save-head span{font-size:12px;color:#8795a8}.wl-report-snapshot-panel{display:grid;gap:12px}.wl-report-snapshot-panel .wl-report-section-heading{margin-bottom:0}.wl-report-snapshot-toolbar{display:flex;align-items:end;flex-wrap:wrap;gap:12px}.wl-report-snapshot-toolbar label{display:grid;gap:6px;flex:1;font-size:12px;color:#61738d;font-weight:650;min-width:210px}.wl-report-snapshot-toolbar input{min-height:42px;border:1px solid #d5deea;border-radius:9px;padding:9px 12px;font-size:13px;width:100%;box-sizing:border-box}.wl-report-snapshot-toolbar button:disabled{opacity:.48;cursor:not-allowed}.wl-report-snapshot-history{display:grid;gap:8px}.wl-report-snapshot-item{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;border:1px solid #e0e7ef;border-radius:9px;background:#fff;color:#30445e;cursor:pointer;text-align:left}.wl-report-snapshot-item:hover{background:#f3f7fb}.wl-report-snapshot-item:disabled{opacity:.5;cursor:wait}.wl-report-snapshot-item span:first-child{display:grid;gap:5px}.wl-report-snapshot-item strong{font-size:13px}.wl-report-snapshot-item small,.wl-report-snapshot-item span:last-child{font-size:11px;color:#788ba4}.wl-report-snapshot-info{font-size:13px;color:#3b6d62;background:#eaf6f1;border-radius:8px;padding:11px 12px}
@media(max-width:850px){.wl-report-kpis{grid-template-columns:repeat(3,1fr);gap:16px}.wl-report-kpis>div{padding:5px 12px!important;border-left:0}}
@media(max-width:540px){.wl-report-summary-save-actions{width:100%;justify-content:stretch}.wl-report-title-field{min-width:0;max-width:none}.wl-report-save-header{min-width:auto}.wl-report-period-controls{width:100%;justify-content:space-between}.wl-report-period-navigation button{padding:8px}.wl-report-panel{padding:16px}.wl-report-collapsible{padding:0}.wl-report-collapse-heading{padding:16px;gap:10px;flex-wrap:wrap}.wl-report-collapse-meta{order:3;width:100%;text-align:left}.wl-report-collapse-content{padding:0 16px 16px}.wl-report-filters label{min-width:calc(50% - 8px)}.wl-report-kpis{grid-template-columns:repeat(2,1fr)}.wl-report-kpis strong{font-size:23px}.wl-report-search{width:100%}}
</style>
