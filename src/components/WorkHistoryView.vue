<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useCategoryStore } from '../stores/categoryStore'
import { useDayStatusStore } from '../stores/dayStatusStore'
import DayStatusBadge from './DayStatusBadge.vue'
import { fetchWorkLogs } from '../api/workLogApi'

const emit = defineEmits(['open-date'])
const categories = useCategoryStore()
const dayStatuses = useDayStatusStore()
const previewDate = ref('')
const lastTouchedDate = ref('')
const shownMonth = ref('')
const holidayError = ref('')
let hoverTimer = null

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function pastDays(days) {
  const value = new Date()
  value.setDate(value.getDate() - days)
  return formatDate(value)
}

const searchText = ref('')
const category = ref('all')
const startDate = ref(pastDays(29))
const endDate = ref(formatDate(new Date()))
const view = ref('list')
const rows = ref([])
const loading = ref(false)
const error = ref('')
const hasSearched = ref(false)
const datesChanged = ref(false)
const searchedRange = ref(null)
const requestId = ref(0)

const availableCategories = computed(() => [...categories.activeCategories].map(x => x.name))
const keyword = computed(() => searchText.value.trim().toLocaleLowerCase())
const matching = computed(() => rows.value.filter(row => {
  if (category.value !== 'all' && row.category !== category.value) return false
  return !keyword.value || `${row.category || ''} ${row.content || ''}`.toLocaleLowerCase().includes(keyword.value)
}).sort((a,b) => b.date.localeCompare(a.date) || (a.type === b.type ? Number(a.sortOrder || 0) - Number(b.sortOrder || 0) : a.type === 'work' ? -1 : 1)))
const grouped = computed(() => {
  const dates = new Map()
  for (const record of matching.value) {
    if (!dates.has(record.date)) dates.set(record.date, [])
    dates.get(record.date).push(record)
  }
  return [...dates].map(([date, logs]) => ({ date, logs }))
})
const totalDays = computed(() => grouped.value.length)
const matchingByDate = computed(() => {
  const result = new Map()
  for (const entry of matching.value) {
    if (!result.has(entry.date)) result.set(entry.date, [])
    result.get(entry.date).push(entry)
  }
  return result
})
const monthLabel = computed(() => {
  if (!shownMonth.value) return ''
  const [year, month] = shownMonth.value.split('-').map(Number)
  return `${year} 年 ${month} 月`
})
function monthGrid(monthKey) {
  if (!monthKey) return { start: '', end: '', dates: [] }
  const [year, month] = monthKey.split('-').map(Number)
  const first = new Date(year, month - 1, 1)
  const last = new Date(year, month, 0)
  const start = new Date(first)
  start.setDate(start.getDate() - (start.getDay() + 6) % 7)
  const end = new Date(last)
  end.setDate(end.getDate() + (7 - end.getDay()) % 7)
  const dates = []
  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) dates.push(formatDate(day))
  return { start: formatDate(start), end: formatDate(end), dates }
}
const visibleGrid = computed(() => monthGrid(shownMonth.value))
const calendarDays = computed(() => visibleGrid.value.dates.map((date) => {
  const [year, month, day] = date.split('-').map(Number)
  const weekday = new Date(year, month - 1, day).getDay()
  return {
    key: date,
    number: day,
    inMonth: date.slice(0, 7) === shownMonth.value,
    matched: matchingByDate.value.has(date),
    count: matchingByDate.value.get(date)?.length || 0,
    status: dayStatuses.getStatusByDate(date),
    weekend: weekday === 0 || weekday === 6,
    sunday: weekday === 0,
    inRange: !!searchedRange.value && date >= searchedRange.value.start && date <= searchedRange.value.end,
  }
}))
const previewLogs = computed(() => matchingByDate.value.get(previewDate.value) || [])
const previewStatus = computed(() => dayStatuses.getStatusByDate(previewDate.value))
const previewLabel = computed(() => {
  if (!previewDate.value) return ''
  const [year, month, day] = previewDate.value.split('-').map(Number)
  const weekday = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][new Date(year,month-1,day).getDay()]
  return `${year} 年 ${month} 月 ${day} 日 · ${weekday}`
})
const previewWork = computed(() => previewLogs.value.filter(x => x.type !== 'overtime'))
const previewOvertime = computed(() => previewLogs.value.filter(x => x.type === 'overtime'))
const sumHours = (items) => items.reduce((sum, x) => sum + (Number(x.hours) || 0), 0)
const previewWorkHours = computed(() => sumHours(previewWork.value))
const previewOvertimeHours = computed(() => sumHours(previewOvertime.value))
const previewCompHours = computed(() => previewOvertime.value.reduce((sum,x) => sum + (Number(x.compTimeHours)||0),0))
function parseEntry(raw) {
  const content = String(raw || '')
  const match = content.match(/^\s*[\[［]\s*([^\]］]+?)\s*[\]］]\s*(?:[-－–—]\s*)?([\s\S]*)$/)
  return match ? { subject: match[1].trim(), body: match[2].trim() } : { subject:'', body:content }
}
function clearHover() {
  if (hoverTimer !== null) clearTimeout(hoverTimer)
  hoverTimer = null
}
function queuePreview(date) {
  clearHover()
  hoverTimer = setTimeout(() => { previewDate.value = date; hoverTimer = null }, 150)
}
function showPreview(date) { clearHover(); previewDate.value = date }
function onCalendarClick(date, event) {
  // 觸控第一次點擊更新面板，第二次點相同日期才前往 Day View；避免 focus 事件搶先改變預覽造成誤判。
  if (event.detail !== 0 && typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
    if (lastTouchedDate.value !== date) {
      lastTouchedDate.value = date
      showPreview(date)
      return
    }
  }
  openDate(date)
}
function shiftMonth(delta) {
  const [year, month] = shownMonth.value.split('-').map(Number)
  const d = new Date(year, month - 1 + delta, 1)
  shownMonth.value = formatDate(d).slice(0, 7)
  lastTouchedDate.value = ''
}
const canPrevious = computed(() => !!searchedRange.value && shownMonth.value > searchedRange.value.start.slice(0, 7))
const canNext = computed(() => !!searchedRange.value && shownMonth.value < searchedRange.value.end.slice(0, 7))
function choosePreviewForMonth() {
  const inMonth = matching.value.find(row => row.date.slice(0,7) === shownMonth.value)?.date
  const fallback = `${shownMonth.value}-01`
  showPreview(inMonth || fallback)
}
// 與工作日曆共用同一個假日 Store，不受工作關鍵字／分類篩選影響。
let statusRequest = 0
watch([shownMonth, view, searchedRange, datesChanged], async () => {
  const id = ++statusRequest
  if (view.value !== 'calendar' || !searchedRange.value || datesChanged.value || !shownMonth.value) return
  holidayError.value = ''
  const {start,end} = visibleGrid.value
  try {
    await dayStatuses.loadRange(start,end,false,true)
  } catch (err) {
    if (id === statusRequest) holidayError.value = '節日資料暫時無法載入，請稍後重新查詢。'
  }
})
watch(shownMonth, (newMonth,oldMonth) => {
  if (newMonth && newMonth !== oldMonth) choosePreviewForMonth()
})
onBeforeUnmount(clearHover)
function categoryStyle(name) {
  const item = categories.getCategory(name)
  return {backgroundColor:item?.bgColor || '#f1f5f9',color:item?.textColor || '#334155'}
}
async function search() {
  error.value = ''
  if (!startDate.value || !endDate.value || startDate.value > endDate.value) {
    error.value = '請選擇正確的日期範圍，開始日期不能晚於結束日期。'
    return
  }
  const from = new Date(`${startDate.value}T12:00:00`)
  const to = new Date(`${endDate.value}T12:00:00`)
  if ((to-from)/86400000 > 366) {
    error.value = '每次最多查詢 367 天，請縮小日期範圍後再搜尋。'
    return
  }
  const id = ++requestId.value
  loading.value = true
  try {
    const result = await fetchWorkLogs(startDate.value, endDate.value)
    if (id !== requestId.value) return
    rows.value = result
    searchedRange.value = {start:startDate.value,end:endDate.value}
    shownMonth.value = endDate.value.slice(0,7)
    choosePreviewForMonth()
    hasSearched.value = true
    datesChanged.value = false
  } catch (e) {
    if (id !== requestId.value) return
    error.value = e instanceof Error ? e.message : '讀取工作歷程失敗'
  } finally {
    if (id === requestId.value) loading.value = false
  }
}
function reset() {
  searchText.value = ''
  category.value = 'all'
  startDate.value = pastDays(29)
  endDate.value = formatDate(new Date())
  rows.value = []
  hasSearched.value = false
  datesChanged.value = false
  searchedRange.value = null
  shownMonth.value = ''
  previewDate.value = ''
  lastTouchedDate.value = ''
  holidayError.value = ''
  clearHover()
  error.value = ''
  ++requestId.value
  loading.value = false
}
function dateLabel(date) {
  const [y,m,d] = date.split('-').map(Number)
  return `${y}/${String(m).padStart(2,'0')}/${String(d).padStart(2,'0')}`
}
function openDate(date) { emit('open-date', date) }
// 關鍵字／分類只篩選已查詢的結果；調整日期後需重新查詢。
watch([startDate,endDate], () => {
  if (hasSearched.value) {
    datesChanged.value = true
    ++requestId.value
    loading.value = false
  }
})
</script>

<template>
  <section class="wl-history" aria-label="工作歷程瀏覽器">
    <div class="wl-history-heading">
      <div>
        <p class="wl-month-eyebrow">WORK HISTORY</p>
        <h1>工作歷程瀏覽器</h1>
        <p>依工作類型、關鍵字與日期，找回之前的工作紀錄。</p>
      </div>
      <div class="wl-history-tabs" aria-label="搜尋結果檢視">
        <button type="button" :class="{active:view==='list'}" :aria-pressed="view==='list'" @click="view='list'">清單</button>
        <button type="button" :class="{active:view==='calendar'}" :aria-pressed="view==='calendar'" @click="view='calendar'">月曆</button>
      </div>
    </div>

    <form class="wl-history-filters" @submit.prevent="search">
      <label class="wl-history-search"><span>搜尋工作內容</span><input v-model="searchText" type="search" placeholder="例如 PTS 小工具、PAB、Rick、Word" /></label>
      <label><span>工作類型</span><select v-model="category"><option value="all">全部類型</option><option v-for="name in availableCategories" :key="name" :value="name">{{ name }}</option></select></label>
      <label><span>起始日期</span><input v-model="startDate" type="date" required /></label>
      <label><span>結束日期</span><input v-model="endDate" type="date" required /></label>
      <button type="button" class="wl-history-clear" @click="reset">重設</button>
      <button type="submit" class="wl-history-submit" :disabled="loading">{{ loading ? '讀取中…' : '搜尋' }}</button>
    </form>
    <p v-if="error" class="wl-history-error" role="alert">{{ error }}</p>
    <div v-if="!hasSearched" class="wl-history-placeholder">設定查詢條件，按下「搜尋」即可閱讀歷史工作紀錄。</div>
    <div v-else-if="datesChanged" class="wl-history-placeholder" role="status">日期範圍已變更，請按「搜尋」重新讀取紀錄。</div>
    <template v-else>
      <div class="wl-history-result-meta" role="status"><span>符合 {{ matching.length }} 筆紀錄，分布於 {{ totalDays }} 天</span><span>查詢範圍：{{ searchedRange ? `${searchedRange.start} ～ ${searchedRange.end}` : '日期已變更，請重新搜尋' }}</span></div>
      <div v-if="!matching.length && view==='list'" class="wl-history-placeholder">這段時間找不到符合的工作紀錄，試試其他關鍵字或分類。</div>
      <div v-else-if="view==='list'" class="wl-history-list">
        <section v-for="group in grouped" :key="group.date" class="wl-history-group">
          <div class="wl-history-date"><h2>{{ dateLabel(group.date) }}</h2><button type="button" @click="openDate(group.date)">前往單日紀錄 ↗</button></div>
          <button v-for="record in group.logs" :key="record.id" type="button" class="wl-history-entry" @click="openDate(record.date)">
            <span class="wl-history-entry-top"><span class="wl-history-entry-heading"><span class="wl-month-category" :style="categoryStyle(record.category)">{{ record.category || '未分類' }}</span><span v-if="parseEntry(record.content).subject" class="wl-history-entry-subject">［{{ parseEntry(record.content).subject }}］</span></span><span class="wl-history-entry-hours">{{ record.type === 'overtime' ? '加班 ' : '' }}{{ record.hours }}h</span></span>
            <span v-if="parseEntry(record.content).body" class="wl-history-entry-content">{{ parseEntry(record.content).body }}</span>
            <span v-if="record.type==='overtime' && Number(record.compTimeHours)>0" class="wl-month-comp">補休 +{{ record.compTimeHours }}h</span>
          </button>
        </section>
      </div>
      <div v-else class="wl-history-calendar-wrap">
        <div class="wl-history-month-heading">
          <div>
            <h2>{{ monthLabel }} · 工作歷程月曆</h2>
            <p>淡藍色代表符合條件的日期；節日標記不受搜尋條件影響，Hover 可在右側閱讀當日紀錄。</p>
          </div>
          <div class="wl-history-month-nav">
            <button type="button" :disabled="!canPrevious" @click="shiftMonth(-1)" aria-label="上個月">‹</button>
            <button type="button" :disabled="!canNext" @click="shiftMonth(1)" aria-label="下個月">›</button>
          </div>
        </div>
        <p v-if="holidayError" role="alert" class="wl-history-holiday-error">{{ holidayError }}</p>
        <div class="wl-history-month-layout">
          <section class="wl-history-calendar-panel" aria-label="工作歷程月份日曆">
            <div class="wl-history-calendar-scroll">
              <div class="wl-history-calendar-grid">
                <span v-for="(label,index) in ['一','二','三','四','五','六','日']" :key="label" class="wl-history-weekday" :class="{'wl-history-sunday':index===6}">週{{ label }}</span>
                <button v-for="day in calendarDays" :key="day.key" type="button"
                  :aria-label="`${day.key}，${day.count} 筆符合的工作紀錄${day.status ? '，有日期狀態' : ''}，預覽或前往單日紀錄`"
                  :class="{'wl-history-calendar-match':day.matched,'wl-history-calendar-outside':!day.inMonth,'wl-history-calendar-preview':previewDate===day.key,'wl-history-calendar-sunday':day.sunday}"
                  @mouseenter="queuePreview(day.key)" @mouseleave="clearHover" @focus="showPreview(day.key)" @click="onCalendarClick(day.key,$event)">
                  <span class="wl-history-day-head"><span>{{ day.number }}</span><DayStatusBadge v-if="day.status" :status="day.status" :show-hours="false" /></span>
                  <span v-if="day.matched" class="wl-history-day-count">{{ day.count }} 筆符合</span>
                </button>
              </div>
            </div>
          </section>
          <aside class="wl-history-preview" aria-label="符合條件的當日工作紀錄預覽">
            <div class="wl-history-preview-head">
              <div><p class="wl-month-eyebrow">SEARCH RESULTS / DAILY PREVIEW</p><h3>{{ previewLabel }}</h3><p>{{ previewLogs.length }} 筆符合搜尋條件</p></div>
              <button type="button" class="wl-month-open" @click="openDate(previewDate)">開啟日誌 ↗</button>
            </div>
            <div v-if="previewStatus" class="wl-history-preview-status"><DayStatusBadge :status="previewStatus" /></div>
            <div class="wl-month-summary">
              <div><span>符合的正常工作</span><strong>{{ previewWorkHours }}h</strong></div>
              <div><span>符合的加班</span><strong class="wl-month-amber">{{ previewOvertimeHours }}h</strong></div>
              <div><span>符合紀錄</span><strong>{{ previewLogs.length }}</strong></div>
            </div>
            <div class="wl-history-preview-scroll" :key="previewDate">
              <template v-if="previewLogs.length">
                <section v-if="previewWork.length" class="wl-month-preview-section">
                  <h3>正常工作 <span>{{ previewWorkHours }}h</span></h3>
                  <article v-for="entry in previewWork" :key="entry.id" class="wl-month-preview-entry">
                    <div class="wl-month-entry-top"><span class="wl-month-entry-heading"><span class="wl-month-category" :style="categoryStyle(entry.category)">{{ entry.category || '未分類' }}</span><span v-if="parseEntry(entry.content).subject" class="wl-month-entry-subject">［{{ parseEntry(entry.content).subject }}］</span></span><strong>{{ entry.hours }}h</strong></div>
                    <div v-if="parseEntry(entry.content).body" class="wl-month-entry-body"><p>{{ parseEntry(entry.content).body }}</p></div>
                  </article>
                </section>
                <section v-if="previewOvertime.length" class="wl-month-preview-section">
                  <h3>加班 <span class="wl-month-amber">{{ previewOvertimeHours }}h</span></h3>
                  <article v-for="entry in previewOvertime" :key="entry.id" class="wl-month-preview-entry wl-month-preview-entry--overtime">
                    <div class="wl-month-entry-top"><span class="wl-month-entry-heading"><span class="wl-month-category" :style="categoryStyle(entry.category)">{{ entry.category || '未分類' }}</span><span v-if="parseEntry(entry.content).subject" class="wl-month-entry-subject">［{{ parseEntry(entry.content).subject }}］</span></span><strong class="wl-month-amber">{{ entry.hours }}h</strong></div>
                    <div v-if="parseEntry(entry.content).body" class="wl-month-entry-body"><p>{{ parseEntry(entry.content).body }}</p></div>
                    <p v-if="Number(entry.compTimeHours)>0" class="wl-month-comp">補休 +{{ entry.compTimeHours }}h</p>
                  </article>
                  <p v-if="previewCompHours>0" class="wl-month-comp-total">符合紀錄的補休 +{{ previewCompHours }}h</p>
                </section>
              </template>
              <div v-else class="wl-month-preview-empty"><p>這一天沒有符合篩選條件的工作紀錄</p><span v-if="previewStatus">假日與日期狀態仍會正常顯示。</span></div>
            </div>
          </aside>
        </div>
      </div>
    </template>
  </section>
</template>
