<script setup>
import { computed, onMounted, ref } from 'vue'
import { fetchWorkLogs } from '../api/workLogApi'
import { useCategoryStore } from '../stores/categoryStore'

const categoryStore = useCategoryStore()
const dateString = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
const today = new Date()
const startDate = ref(dateString(new Date(today.getFullYear(), today.getMonth(), 1)))
const endDate = ref(dateString(today))
const selectedCategory = ref('all')
const loadedPeriod = ref({start: '', end: ''})
const rows = ref([])
const loading = ref(false)
const error = ref('')
const fetched = ref(false)
const stale = ref(false)
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
function applyPeriod(period) {
  const date = new Date()
  endDate.value = dateString(date)
  if (period === 'week') {
    const day = (date.getDay()+6)%7
    date.setDate(date.getDate()-day)
    startDate.value = dateString(date)
  } else if (period === 'month') {
    startDate.value = dateString(new Date(date.getFullYear(),date.getMonth(),1))
  } else {
    startDate.value = dateString(new Date(date.getFullYear(),0,1))
  }
  stale.value = true
  void search()
}
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
function handleDateChange() {stale.value = true}
function formatDate(value) {
  const [y,m,d] = value.split('-')
  return `${y}/${m}/${d}`
}
onMounted(() => {void search()})
</script>

<template>
  <div class="wl-report">
    <header class="wl-report-header">
      <div><p class="wl-report-eyebrow">REPORTS / WORK ANALYSIS</p><h1>工作報告</h1><p>用數據回顧工作分布，並保留完整的每日工作內容。</p></div>
      <span class="wl-report-phase">PHASE 2 · 專案與分類統計</span>
    </header>

    <section class="wl-report-panel wl-report-filters" aria-label="報告查詢條件">
      <div class="wl-report-periods">
        <button type="button" @click="applyPeriod('week')">本週</button>
        <button type="button" @click="applyPeriod('month')">本月</button>
        <button type="button" @click="applyPeriod('year')">今年</button>
      </div>
      <label>開始日期<input v-model="startDate" type="date" @change="handleDateChange" /></label>
      <label>結束日期<input v-model="endDate" type="date" @change="handleDateChange" /></label>
      <label>工作分類<select v-model="selectedCategory"><option value="all">全部分類</option><option v-for="name in categoryNames" :key="name" :value="name">{{ name }}</option></select></label>
      <button type="button" class="wl-report-search" :disabled="loading" @click="search">{{ loading ? '查詢中…' : '產生報告' }}</button>
    </section>
    <p v-if="error" class="wl-report-error" role="alert">{{ error }}</p>
    <p v-if="stale && fetched" class="wl-report-notice">日期已變更，請按「產生報告」更新下方資料。</p>
    <div v-if="loading && !fetched" class="wl-report-panel wl-report-empty">正在整理工作紀錄…</div>
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
        <div class="wl-report-section-heading"><div><p class="wl-report-eyebrow">02 / SUMMARY</p><h2>工作摘要</h2></div><span>AI 摘要於 Phase 3 啟用</span></div>
        <p v-if="!filtered.length" class="wl-report-muted">目前沒有可整理的工作內容。</p>
        <template v-else><p class="wl-report-summary">本期間共記錄 {{ filtered.length }} 筆工作，涵蓋 {{ workDays }} 個日期、{{ projectCount }} 個可辨識專案，累計 {{ formatHours(allHours) }}，其中一般工時 {{ formatHours(workHours) }}、加班 {{ formatHours(overtimeHours) }}。</p><p class="wl-report-muted">目前為原始資料統計摘要。後續接入 GPT API 後，這裡會產生可編輯的工作成果與待追蹤事項，不會虛構工作進度。</p></template>
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
.wl-report-periods{display:flex;gap:4px;padding:4px;background:#f1f4f8;border-radius:10px}
.wl-report-periods button{border:0;background:transparent;border-radius:7px;padding:9px 12px;font-size:13px;color:#425773;cursor:pointer}
.wl-report-periods button:hover{background:#fff}
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
.wl-report-empty{color:#8492a5;text-align:center;padding:30px;font-size:13px}
.wl-report-error,.wl-report-notice{padding:12px 15px;border-radius:9px;font-size:13px;background:#fff1f1;color:#b03737}
.wl-report-notice{background:#fff8e8;color:#8c681d}
@media(max-width:850px){.wl-report-kpis{grid-template-columns:repeat(3,1fr);gap:16px}.wl-report-kpis>div{padding:5px 12px!important;border-left:0}}
@media(max-width:540px){.wl-report-panel{padding:16px}.wl-report-collapsible{padding:0}.wl-report-collapse-heading{padding:16px;gap:10px;flex-wrap:wrap}.wl-report-collapse-meta{order:3;width:100%;text-align:left}.wl-report-collapse-content{padding:0 16px 16px}.wl-report-filters label{min-width:calc(50% - 8px)}.wl-report-kpis{grid-template-columns:repeat(2,1fr)}.wl-report-kpis strong{font-size:23px}.wl-report-search{width:100%}}
</style>
