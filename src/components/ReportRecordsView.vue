<script setup>
import { computed, ref } from 'vue'
import { getSavedWorkReport, listSavedWorkReportsByRange, saveWorkReportSnapshot } from '../api/reportSnapshotApi'
import { printSavedReport, downloadSavedReportDocx, EXPORT_SECTIONS } from '../api/reportExport'

const allReports = ref([])
const loadingList = ref(false)
const loadingReport = ref(false)
const saving = ref(false)
const exportingWord = ref(false)
const exportDialog = ref(false)
const exportType = ref('pdf')
const selectedSections = ref(EXPORT_SECTIONS.map(s => s.key))
const exporting = computed(() => exportingWord.value)
function openExport(type) {
  if (!selected.value || editing.value || exporting.value) return
  exportType.value = type
  selectedSections.value = EXPORT_SECTIONS.map(s => s.key)
  exportDialog.value = true
  error.value = ''
}
function toggleSection(key) {
  selectedSections.value = selectedSections.value.includes(key)
    ? selectedSections.value.filter(x => x !== key)
    : EXPORT_SECTIONS.map(s => s.key).filter(x => selectedSections.value.includes(x) || x === key)
}
function chooseAll() { selectedSections.value = EXPORT_SECTIONS.map(s => s.key) }
function chooseSummaryOnly() { selectedSections.value = ['summary'] }
async function confirmExport() {
  if (!selected.value || !selectedSections.value.length || exporting.value) return
  const sections = [...selectedSections.value]
  if (exportType.value === 'pdf') {
    exportPdf(sections)
    exportDialog.value = false
  } else {
    await exportWord(sections)
    if (!error.value) exportDialog.value = false
  }
}

const error = ref('')
const notice = ref('')
const keyword = ref('')
const startDate = ref('')
const endDate = ref('')
const searchedPeriod = ref(null)
let searchSeq = 0
const selected = ref(null)
const editing = ref(false)
const draft = ref(null)
const draftTitle = ref('')
const expandedDetails = ref(false)
const expandedProjects = ref(false)
const expandedCategories = ref(false)
let loadSeq = 0
const fmtDate = value => String(value || '').replaceAll('-', '/')
const fmtHours = value => `${Math.round((Number(value) || 0) * 100) / 100}h`
const fmtTime = value => value ? new Date(value).toLocaleString('zh-TW', { hour12: false }) : '未記錄'
const matches = computed(() => {
  const term = keyword.value.trim().toLocaleLowerCase()
  return allReports.value.filter(x => !term || [x.title, x.start_date, x.end_date].some(v => String(v || '').toLocaleLowerCase().includes(term)))
})
const totalHours = computed(() => selected.value?.stats?.totalHours ?? 0)
const report = computed(() => editing.value ? draft.value : selected.value?.report)
const groups = computed(() => {
  const grouped = new Map()
  for (const item of selected.value?.details || []) {
    const day = item.date || '未標記日期'
    if (!grouped.has(day)) grouped.set(day, [])
    grouped.get(day).push(item)
  }
  return [...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0]))
})
function clearResults() {
  ++searchSeq
  ++loadSeq
  searchedPeriod.value = null
  allReports.value = []
  selected.value = null
  exportDialog.value = false
  editing.value = false
  draft.value = null
  notice.value = ''
  error.value = ''
  loadingList.value = false
  loadingReport.value = false
}
async function reload() {
  if (!startDate.value || !endDate.value || startDate.value > endDate.value) {
    clearResults()
    error.value = '請選擇有效的開始日期與結束日期。'
    return
  }
  const seq = ++searchSeq
  const period = { start: startDate.value, end: endDate.value }
  loadingList.value = true
  error.value = ''
  notice.value = ''
  selected.value = null
  exportDialog.value = false
  editing.value = false
  allReports.value = []
  searchedPeriod.value = null
  try {
    const results = await listSavedWorkReportsByRange(period.start, period.end)
    if (seq !== searchSeq) return
    allReports.value = results
    searchedPeriod.value = period
  } catch (err) {
    if (seq === searchSeq) error.value = err?.message || '報告紀錄讀取失敗。'
  } finally {
    if (seq === searchSeq) loadingList.value = false
  }
}
async function openReport(id) {
  if (loadingReport.value || saving.value) return
  const seq = ++loadSeq
  loadingReport.value = true
  error.value = ''
  notice.value = ''
  editing.value = false
  try {
    const item = await getSavedWorkReport(id)
    if (seq !== loadSeq) return
    if (!item?.report || typeof item.report.overview !== 'string' || !Array.isArray(item.report.projectHighlights) || !Array.isArray(item.report.decisions) || !Array.isArray(item.report.followUps)) throw Error('儲存的報告資料格式不完整。')
    selected.value = item
    draft.value = null
    draftTitle.value = item.title
    expandedDetails.value = false
    expandedProjects.value = false
    expandedCategories.value = false
  } catch (err) { if (seq === loadSeq) error.value = err?.message || '開啟報告失敗。' }
  finally { if (seq === loadSeq) loadingReport.value = false }
}
function exportPdf(sections) {
  if (!selected.value || editing.value) return
  error.value = ''
  try { printSavedReport(selected.value, sections) }
  catch (err) { error.value = err?.message || '無法開啟列印視窗。' }
}
async function exportWord(sections) {
  if (!selected.value || editing.value || exportingWord.value) return
  error.value = ''
  exportingWord.value = true
  try { await downloadSavedReportDocx(selected.value, sections) }
  catch (err) { error.value = err?.message || 'Word 匯出失敗。' }
  finally { exportingWord.value = false }
}
function edit() {
  if (!selected.value) return
  draft.value = JSON.parse(JSON.stringify(selected.value.report))
  draftTitle.value = selected.value.title
  editing.value = true
  notice.value = ''
}
function cancel() {
  editing.value = false
  draft.value = null
  draftTitle.value = selected.value?.title || ''
}
async function saveNewVersion() {
  if (!selected.value || !editing.value || saving.value) return
  const title = draftTitle.value.trim()
  if (!title || title.length > 160) { error.value = '報告名稱需為 1～160 字。'; return }
  error.value = ''
  saving.value = true
  try {
    const created = await saveWorkReportSnapshot({
      start_date: selected.value.start_date,
      end_date: selected.value.end_date,
      title,
      report: JSON.parse(JSON.stringify(draft.value)),
      stats: JSON.parse(JSON.stringify(selected.value.stats)),
      details: JSON.parse(JSON.stringify(selected.value.details)),
      ai_model: selected.value.ai_model,
      ai_usage: selected.value.ai_usage,
      ai_generated_at: selected.value.ai_generated_at,
    })
    // 新版本屬於目前搜尋範圍，更新結果但不觸發載入舊版。
    const newList = await listSavedWorkReportsByRange(searchedPeriod.value.start, searchedPeriod.value.end)
    allReports.value = newList
    await openReportAfterSave(created.id)
    notice.value = '已另存新版本。原始報告完整保留，工時與明細仍是原儲存時的快照。'
  } catch (err) { error.value = err?.message || '儲存新版本失敗。' }
  finally { saving.value = false }
}
async function openReportAfterSave(id) {
  // 這裡不走 openReport 的 saving 防護，因為儲存流程尚未結束。
  const item = await getSavedWorkReport(id)
  selected.value = item
  draftTitle.value = item.title
  draft.value = null
  editing.value = false
}
</script>

<template>
  <div class="records-page">
    <header class="records-header"><div><p class="eyebrow">REPORT ARCHIVE</p><h1>報告紀錄</h1><p>查閱已儲存報告，並在這裡編輯與另存新版本。</p></div></header>
    <section class="records-panel">
      <div class="records-toolbar"><h2>搜尋已儲存報告</h2></div>
      <form class="records-search-form" @submit.prevent="reload">
        <label class="records-field">開始日期<input v-model="startDate" type="date" class="records-input" @change="clearResults" /></label>
        <label class="records-field">結束日期<input v-model="endDate" type="date" class="records-input" @change="clearResults" /></label>
        <button type="submit" class="records-search-button" :disabled="loadingList || !startDate || !endDate || startDate > endDate">{{ loadingList ? '搜尋中…' : '搜尋報告' }}</button>
      </form>
      <template v-if="searchedPeriod">
        <div class="records-toolbar"><h2>搜尋結果</h2><span class="records-muted">{{ fmtDate(searchedPeriod.start) }} ～ {{ fmtDate(searchedPeriod.end) }} · 共 {{ matches.length }} 份</span></div>
        <input v-model="keyword" class="records-input" type="search" placeholder="進一步篩選報告名稱" aria-label="篩選搜尋結果" />
        <div v-if="!matches.length" class="records-muted">這段期間沒有符合條件的已儲存報告。</div>
        <div v-else class="records-list">
          <button v-for="item in matches" :key="item.id" type="button" :class="['records-list-row', { chosen: selected?.id === item.id }]" :disabled="loadingReport || saving" @click="openReport(item.id)">
            <span><strong>{{ item.title }}</strong><small>{{ fmtDate(item.start_date) }} ～ {{ fmtDate(item.end_date) }}</small></span>
            <span class="records-list-date">{{ fmtTime(item.created_at) }}<span>檢視報告 ›</span></span>
          </button>
        </div>
        <p class="records-muted">顯示報告期間與搜尋區間有交集的最近 200 份報告。每次另存都會保留獨立版本。</p>
      </template>
      <p v-else-if="loadingList" class="records-muted">正在搜尋已儲存報告…</p>
      <p v-else class="records-muted">請先選擇日期區間並按「搜尋報告」，才會顯示歷史報告。</p>
    </section>
    <p v-if="error" class="records-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="records-success" role="status">{{ notice }}</p>
    <section v-if="loadingReport" class="records-panel records-muted">正在開啟已儲存報告…</section>
    <template v-if="selected && !loadingReport">
      <section class="records-panel">
        <div class="records-toolbar"><div><p class="eyebrow">SAVED SNAPSHOT</p><h2>{{ selected.title }}</h2><p class="records-muted">{{ fmtDate(selected.start_date) }} ～ {{ fmtDate(selected.end_date) }} · 儲存於 {{ fmtTime(selected.created_at) }}</p></div>
          <div class="records-actions"><template v-if="!editing"><button type="button" :disabled="exportingWord" @click="openExport('pdf')">列印／另存 PDF</button><button type="button" :disabled="exportingWord" @click="openExport('word')">{{ exportingWord ? '匯出中…' : '下載 Word' }}</button><button type="button" class="primary" @click="edit">編輯此報告</button></template><template v-else><button type="button" @click="cancel">取消編輯</button><button type="button" class="primary" :disabled="saving" @click="saveNewVersion">{{ saving ? '儲存中…' : '另存新版本' }}</button></template></div>
        </div>
        <label v-if="editing" class="records-field">報告名稱<input v-model="draftTitle" maxlength="160" class="records-input" /></label>
        <div class="records-stats"><div><span>總工時</span><strong>{{ fmtHours(totalHours) }}</strong></div><div><span>一般工作</span><strong>{{ fmtHours(selected.stats?.workHours) }}</strong></div><div><span>加班</span><strong>{{ fmtHours(selected.stats?.overtimeHours) }}</strong></div><div><span>工作筆數</span><strong>{{ selected.stats?.recordCount ?? selected.details?.length ?? 0 }}</strong></div></div>
        <p class="records-muted">以上為儲存當下的工時快照，不因修改 AI 文字或原始工作紀錄而改變。匯出使用目前開啟的已儲存版本；如有編輯，請先另存新版本。</p>
      </section>
      <section v-if="report" class="records-panel records-report">
        <div class="records-toolbar"><div><p class="eyebrow">AI WORK SUMMARY</p><h2>工作成果摘要</h2></div><span class="records-muted">{{ selected.ai_model || 'AI 模型未記錄' }}</span></div>
        <div class="records-section"><h3>01 / 本期工作概況</h3><textarea v-if="editing" v-model="draft.overview" rows="5" class="records-input" aria-label="編輯本期工作概況"/><p v-else>{{ report.overview }}</p></div>
        <div class="records-section"><h3>02 / 各專案工作成果</h3><div v-for="(item, i) in report.projectHighlights" :key="i" class="records-entry"><template v-if="editing"><label class="records-field">專案名稱<input v-model="item.project" class="records-input" /></label><label class="records-field">成果描述<textarea v-model="item.result" rows="3" class="records-input" /></label></template><template v-else><h4>{{ item.project }}</h4><p>{{ item.result }}</p></template></div><p v-if="!report.projectHighlights.length" class="records-muted">無專案成果。</p></div>
        <div class="records-section"><h3>03 / 重要決議</h3><div v-for="(item, i) in report.decisions" :key="i" class="records-entry"><textarea v-if="editing" v-model="draft.decisions[i]" rows="2" class="records-input" :aria-label="`編輯決議 ${i+1}`"/><p v-else>{{ item }}</p></div><p v-if="!report.decisions.length" class="records-muted">無重要決議。</p></div>
        <div class="records-section"><h3>04 / 待追蹤事項</h3><div v-for="(item, i) in report.followUps" :key="i" class="records-entry"><template v-if="editing"><label class="records-field">事項<input v-model="item.task" class="records-input" /></label><label class="records-field">後續處理<textarea v-model="item.nextStep" rows="2" class="records-input" /></label><label class="records-field">期限（若無可留空）<input v-model="item.dueDate" class="records-input" /></label></template><template v-else><h4>{{ item.task }} <small v-if="item.dueDate">{{ item.dueDate }}</small></h4><p>{{ item.nextStep }}</p></template></div><p v-if="!report.followUps.length" class="records-muted">無待追蹤事項。</p></div>
      </section>
      <section class="records-panel">
        <details :open="expandedProjects" @toggle="expandedProjects = $event.target.open"><summary>各專案工時 <span>{{ selected.stats?.projectStats?.length || 0 }} 個分類</span></summary><div v-for="item in selected.stats?.projectStats || []" :key="item.name" class="records-stat-row"><span>{{ item.name }}</span><strong>{{ fmtHours(item.hours) }}</strong></div></details>
        <details :open="expandedCategories" @toggle="expandedCategories = $event.target.open"><summary>各工作分類工時 <span>{{ selected.stats?.categoryStats?.length || 0 }} 個分類</span></summary><div v-for="item in selected.stats?.categoryStats || []" :key="item.name" class="records-stat-row"><span>{{ item.name }}</span><strong>{{ fmtHours(item.hours) }}</strong></div></details>
        <details :open="expandedDetails" @toggle="expandedDetails = $event.target.open"><summary>每日工作明細 <span>{{ selected.details?.length || 0 }} 筆紀錄</span></summary><div v-for="[day, items] in groups" :key="day" class="records-day"><h4>{{ fmtDate(day) }}</h4><div v-for="(entry, i) in items" :key="entry.id || i" class="records-detail"><span>{{ entry.category || '未分類' }} · {{ entry.type === 'overtime' ? '加班' : '一般' }} · {{ fmtHours(entry.hours) }}</span><p>{{ entry.content }}</p></div></div></details>
      </section>
      <div v-if="editing" class="records-bottom-actions"><button type="button" @click="cancel">取消編輯</button><button type="button" class="primary" :disabled="saving" @click="saveNewVersion">{{ saving ? '儲存中…' : '另存新版本' }}</button></div>
    </template>
    <div v-if="exportDialog" class="records-export-overlay" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="records-export-title" class="records-export-dialog">
        <div class="records-export-header">
          <div><p class="eyebrow">EXPORT SETTINGS</p><h2 id="records-export-title">選擇匯出內容</h2></div>
          <button type="button" class="records-export-close" aria-label="關閉匯出選項" :disabled="exporting" @click="exportDialog = false">×</button>
        </div>
        <p class="records-muted">{{ exportType === 'pdf' ? 'PDF 列印／另存' : 'Word 文件' }} · {{ selected?.title }}</p>
        <div class="records-export-quick">
          <button type="button" @click="chooseAll">全部選取</button>
          <button type="button" @click="chooseSummaryOnly">只選 AI 摘要</button>
        </div>
        <div class="records-export-list">
          <label v-for="section in EXPORT_SECTIONS" :key="section.key" class="records-export-option">
            <input type="checkbox" :checked="selectedSections.includes(section.key)" :disabled="exporting" @change="toggleSection(section.key)" />
            <span>{{ section.label }}</span>
          </label>
        </div>
        <p v-if="!selectedSections.length" class="records-error" role="alert">請至少選擇一個匯出區塊。</p>
        <div class="records-export-actions">
          <button type="button" :disabled="exporting" @click="exportDialog = false">取消</button>
          <button type="button" class="primary" :disabled="!selectedSections.length || exporting" @click="confirmExport">{{ exporting ? '匯出中…' : exportType === 'pdf' ? '產生 PDF' : '下載 Word' }}</button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.records-page{display:grid;gap:20px;color:#243348;min-width:0}.records-header{padding:4px}.records-header h1{font-size:28px;margin:0 0 7px}.records-header p:not(.eyebrow){color:#607189;font-size:14px;margin:0}.eyebrow{font-size:11px;font-weight:700;letter-spacing:.09em;color:#657d9b;margin:0 0 6px}.records-panel{background:#fff;border:1px solid #e1e8f0;border-radius:14px;padding:22px;display:grid;gap:14px;min-width:0}.records-toolbar{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}.records-toolbar h2{font-size:19px;margin:0}.records-search-form{display:flex;align-items:end;flex-wrap:wrap;gap:12px}.records-search-form .records-field{flex:1;min-width:180px}.records-search-button{border:0;background:#304d70;color:#fff;border-radius:9px;padding:11px 18px;min-height:41px;cursor:pointer;font-weight:650}.records-search-button:disabled{opacity:.5;cursor:not-allowed}.records-toolbar button,.records-bottom-actions button{border:1px solid #ccd7e5;background:white;border-radius:9px;padding:10px 15px;cursor:pointer;color:#33465f;font-size:13px}.records-toolbar button.primary,.records-bottom-actions button.primary{background:#304d70;border-color:#304d70;color:#fff}.records-toolbar button:disabled,.records-bottom-actions button:disabled{opacity:.5;cursor:wait}.records-actions,.records-bottom-actions{display:flex;gap:8px;flex-wrap:wrap}.records-bottom-actions{justify-content:flex-end}.records-input{box-sizing:border-box;width:100%;border:1px solid #d2ddea;border-radius:9px;padding:11px 12px;font:inherit;font-size:14px;min-height:41px;background:#fff;color:#243348}.records-field{display:grid;gap:7px;color:#586c83;font-weight:600;font-size:13px}.records-muted{font-size:12px;color:#71829a;margin:0}.records-error,.records-success{margin:0;padding:12px;border-radius:9px;font-size:13px}.records-error{color:#953b3b;background:#fff1f1}.records-success{color:#326552;background:#eaf6f0}.records-list{display:grid;gap:7px}.records-list-row{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;text-align:left;background:#fff;border:1px solid #e0e8f0;border-radius:9px;padding:12px 14px;cursor:pointer;color:#253750}.records-list-row:hover,.records-list-row.chosen{background:#f3f7fc;border-color:#bccbdf}.records-list-row:disabled{opacity:.6}.records-list-row>span{display:grid;gap:5px}.records-list-row small,.records-list-date{font-size:12px;color:#6c7e94}.records-list-date{text-align:right}.records-list-date span{font-size:11px;color:#4a6787}.records-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.records-stats>div{display:grid;gap:5px;background:#f5f7fa;padding:14px;border-radius:9px}.records-stats span{color:#718098;font-size:12px}.records-stats strong{font-size:22px}.records-report{gap:0}.records-section{padding:22px 0;border-top:1px solid #e6ebf1;display:grid;gap:12px}.records-section:first-of-type{border-top:0}.records-section h3{font-size:14px;margin:0;color:#364f6f}.records-section p,.records-entry p{font-size:14px;line-height:1.9;white-space:pre-wrap;margin:0}.records-entry{padding:0 0 12px;display:grid;gap:9px}.records-entry h4{font-size:14px;margin:0}.records-entry small{font-size:11px;color:#7a899d}.records-panel details{border-top:1px solid #e5ebf2;padding:14px 0}.records-panel details:first-child{border-top:0}.records-panel summary{cursor:pointer;font-size:15px;font-weight:650;display:flex;justify-content:space-between;gap:12px}.records-panel summary span{color:#7c8ba1;font-weight:400;font-size:12px}.records-stat-row{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid #f0f3f7;font-size:13px}.records-day{margin-top:18px}.records-day h4{margin:0 0 7px}.records-detail{padding:9px 0;border-bottom:1px solid #eef1f5}.records-detail span{font-size:11px;color:#73849b}.records-detail p{font-size:13px;line-height:1.8;white-space:pre-wrap}@media(max-width:650px){.records-panel{padding:16px}.records-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.records-list-row{align-items:flex-start;flex-direction:column}.records-list-date{text-align:left}}
</style>

<style scoped>
.records-export-overlay{position:fixed;inset:0;z-index:1000;background:rgba(27,41,59,.45);display:flex;align-items:center;justify-content:center;padding:18px}
.records-export-dialog{width:min(100%,480px);max-height:90vh;overflow:auto;background:white;border:1px solid #dbe4ed;border-radius:16px;padding:24px;box-shadow:0 16px 60px rgba(20,38,65,.2);display:grid;gap:16px}
.records-export-header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.records-export-header h2{font-size:21px;margin:0}.records-export-close{border:0;background:none;font-size:28px;line-height:1;cursor:pointer;color:#687b94}
.records-export-quick{display:flex;flex-wrap:wrap;gap:8px}.records-export-quick button{padding:7px 12px;background:#f1f5fa;border:1px solid #dfe7f0;border-radius:8px;color:#364c68;cursor:pointer}
.records-export-list{display:grid;gap:8px}.records-export-option{display:flex;gap:12px;align-items:center;padding:12px;border:1px solid #e0e8f1;border-radius:9px;font-size:14px;cursor:pointer}.records-export-option input{width:17px;height:17px;accent-color:#304d70}
.records-export-actions{display:flex;justify-content:flex-end;gap:10px}.records-export-actions button{border:1px solid #d4deea;border-radius:9px;background:white;padding:10px 16px;cursor:pointer}.records-export-actions button.primary{background:#304d70;color:white;border-color:#304d70}.records-export-actions button:disabled{opacity:.45;cursor:not-allowed}
</style>
