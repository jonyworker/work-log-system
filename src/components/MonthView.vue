<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useCategoryStore } from '../stores/categoryStore'
import DayStatusBadge from './DayStatusBadge.vue'

const props = defineProps({
  days: { type: Array, default: () => [] },
  logs: { type: Array, default: () => [] },
  dayStatuses: { type: Array, default: () => [] },
  selectedDate: { type: String, required: true },
})
const emit = defineEmits(['select-date'])
const categoryStore = useCategoryStore()
const previewDate = ref(props.selectedDate)
let hoverTimer = null

const weekLabels = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']
const weekdayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const byDate = computed(() => {
  const groups = new Map()
  props.logs.forEach((entry) => {
    if (!groups.has(entry.date)) groups.set(entry.date, [])
    groups.get(entry.date).push(entry)
  })
  for (const group of groups.values()) {
    group.sort((a, b) => (a.type === b.type ? Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) : a.type === 'work' ? -1 : 1))
  }
  return groups
})
const statusesByDate = computed(() => new Map(props.dayStatuses.map((status) => [status.date, status])))
const monthData = computed(() => props.days.map((day) => {
  const items = byDate.value.get(day.date) ?? []
  const workItems = items.filter((item) => item.type === 'work')
  const overtimeItems = items.filter((item) => item.type === 'overtime')
  return {
    ...day,
    items,
    workItems,
    overtimeItems,
    workHours: workItems.reduce((sum, item) => sum + (Number(item.hours) || 0), 0),
    overtimeHours: overtimeItems.reduce((sum, item) => sum + (Number(item.hours) || 0), 0),
    compHours: overtimeItems.reduce((sum, item) => sum + (Number(item.compTimeHours) || 0), 0),
    status: statusesByDate.value.get(day.date) ?? null,
  }
}))
const previewDay = computed(() => monthData.value.find((day) => day.date === previewDate.value) ?? monthData.value.find((day) => day.date === props.selectedDate) ?? monthData.value.find((day) => day.inCurrentMonth) ?? null)
const displayedDate = computed(() => {
  if (!previewDay.value) return ''
  const [year, month, day] = previewDay.value.date.split('-').map(Number)
  return `${year} 年 ${month} 月 ${day} 日`
})
const displayedWeekday = computed(() => {
  if (!previewDay.value) return ''
  const [year, month, day] = previewDay.value.date.split('-').map(Number)
  return weekdayNames[new Date(year, month - 1, day).getDay()]
})

function dateColor(day) {
  return day.weekdayIndex === 0 ? 'wl-month-sunday' : day.weekdayIndex === 6 ? 'wl-month-saturday' : ''
}
function categoryStyle(categoryName) {
  const category = categoryStore.getCategory(categoryName)
  return { backgroundColor: category?.bgColor || '#f1f5f9', color: category?.textColor || '#334155' }
}
function parsedContent(raw) {
  const content = String(raw || '')
  const match = content.match(/^\s*[\[［]\s*([^\]］]+?)\s*[\]］]\s*(?:[-－–—]\s*)?([\s\S]*)$/)
  return match ? { subject: match[1].trim(), body: match[2].trim() } : { subject: '', body: content }
}
function clearHoverTimer() {
  if (hoverTimer !== null) clearTimeout(hoverTimer)
  hoverTimer = null
}
function queuePreview(date) {
  clearHoverTimer()
  hoverTimer = setTimeout(() => { previewDate.value = date; hoverTimer = null }, 150)
}
function showPreview(date) {
  clearHoverTimer()
  previewDate.value = date
}
function openDay(date) {
  clearHoverTimer()
  emit('select-date', date)
}
function onDateClick(date, event) {
  // Touch screens have no hover: first tap previews, second tap opens Day View.
  if (event.detail !== 0 && typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches && previewDate.value !== date) {
    showPreview(date)
    return
  }
  openDay(date)
}
watch(() => props.selectedDate, (date) => { showPreview(date) })
watch(() => props.days.map((day) => day.date).join('|'), () => {
  clearHoverTimer()
  if (!props.days.some((day) => day.date === previewDate.value && day.inCurrentMonth)) {
    previewDate.value = props.days.find((day) => day.inCurrentMonth)?.date || props.selectedDate
  }
})
onBeforeUnmount(clearHoverTimer)
</script>

<template>
  <div class="wl-month-layout">
    <section class="wl-month-calendar" aria-label="月份工作日曆">
      <div class="wl-month-calendar-scroll">
        <div class="wl-month-weekdays">
          <div v-for="(label, index) in weekLabels" :key="label" :class="index === 5 ? 'wl-month-saturday' : index === 6 ? 'wl-month-sunday' : ''">{{ label }}</div>
        </div>
        <div class="wl-month-days">
          <article
            v-for="day in monthData"
            :key="day.date"
            class="wl-month-cell"
            :class="{
              'wl-month-cell--outside': !day.inCurrentMonth,
              'wl-month-cell--preview': previewDay?.date === day.date,
              'wl-month-cell--today': selectedDate === day.date,
            }"
            @mouseenter="queuePreview(day.date)"
            @mouseleave="clearHoverTimer"
          >
            <button
              type="button"
              class="wl-month-date-button"
              :aria-label="`${day.date}，工作 ${day.workHours} 小時，加班 ${day.overtimeHours} 小時，${day.items.length} 筆紀錄`"
              :aria-current="selectedDate === day.date ? 'date' : undefined"
              @focus="showPreview(day.date)"
              @click="onDateClick(day.date, $event)"
            >
              <span class="wl-month-cell-head">
                <span class="wl-month-date-number" :class="dateColor(day)">{{ day.dayNumber }}</span>
                <DayStatusBadge v-if="day.status" :status="day.status" class="wl-month-holiday" />
              </span>
              <span class="wl-month-cell-foot">
                <span v-if="day.items.length" class="wl-month-hours">工作 {{ day.workHours }}h</span>
                <span v-if="day.overtimeHours" class="wl-month-overtime">加班 {{ day.overtimeHours }}h</span>
                <span class="wl-month-count">{{ day.items.length ? `${day.items.length} 筆紀錄` : '尚無紀錄' }}</span>
              </span>
            </button>
          </article>
        </div>
      </div>
    </section>

    <aside class="wl-month-preview" aria-label="當日工作紀錄預覽">
      <template v-if="previewDay">
        <div class="wl-month-preview-head">
          <div>
            <p class="wl-month-eyebrow">DAILY JOURNAL</p>
            <h2>{{ displayedDate }}</h2>
            <p class="wl-month-subtitle">{{ displayedWeekday }} · {{ previewDay.items.length }} 筆紀錄</p>
          </div>
          <button type="button" class="wl-month-open" @click="openDay(previewDay.date)">開啟日誌 ↗</button>
        </div>
        <div v-if="previewDay.status" class="wl-month-status"><DayStatusBadge :status="previewDay.status" /></div>
        <div class="wl-month-summary">
          <div><span>正常工作</span><strong>{{ previewDay.workHours }}h</strong></div>
          <div><span>加班</span><strong class="wl-month-amber">{{ previewDay.overtimeHours }}h</strong></div>
          <div><span>紀錄</span><strong>{{ previewDay.items.length }}</strong></div>
        </div>
        <div class="wl-month-preview-scroll" :key="previewDay.date">
          <template v-if="previewDay.items.length">
            <section v-if="previewDay.workItems.length" class="wl-month-preview-section">
              <h3>正常工作 <span>{{ previewDay.workHours }}h</span></h3>
              <article v-for="entry in previewDay.workItems" :key="entry.id" class="wl-month-preview-entry">
                <div class="wl-month-entry-top"><span class="wl-month-entry-heading"><span class="wl-month-category" :style="categoryStyle(entry.category)">{{ entry.category }}</span><span v-if="parsedContent(entry.content).subject" class="wl-month-entry-subject">［{{ parsedContent(entry.content).subject }}］</span></span><strong>{{ entry.hours }}h</strong></div>
                <div v-if="parsedContent(entry.content).body" class="wl-month-entry-body"><p>{{ parsedContent(entry.content).body }}</p></div>
              </article>
            </section>
            <section v-if="previewDay.overtimeItems.length" class="wl-month-preview-section">
              <h3>加班 <span class="wl-month-amber">{{ previewDay.overtimeHours }}h</span></h3>
              <article v-for="entry in previewDay.overtimeItems" :key="entry.id" class="wl-month-preview-entry wl-month-preview-entry--overtime">
                <div class="wl-month-entry-top"><span class="wl-month-entry-heading"><span class="wl-month-category" :style="categoryStyle(entry.category)">{{ entry.category }}</span><span v-if="parsedContent(entry.content).subject" class="wl-month-entry-subject">［{{ parsedContent(entry.content).subject }}］</span></span><strong class="wl-month-amber">{{ entry.hours }}h</strong></div>
                <div v-if="parsedContent(entry.content).body" class="wl-month-entry-body"><p>{{ parsedContent(entry.content).body }}</p></div>
                <p v-if="Number(entry.compTimeHours) > 0" class="wl-month-comp">補休 +{{ entry.compTimeHours }}h</p>
              </article>
              <p v-if="previewDay.compHours > 0" class="wl-month-comp-total">當日補休 +{{ previewDay.compHours }}h</p>
            </section>
          </template>
          <div v-else class="wl-month-preview-empty"><p>當日尚無工作紀錄</p><span>你仍可查看假日資訊，或開啟 Day View 新增紀錄。</span></div>
        </div>
      </template>
      <div v-else class="wl-month-preview-empty">本月沒有可預覽的日期。</div>
    </aside>
  </div>
</template>
