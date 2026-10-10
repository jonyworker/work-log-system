<script setup>
import { computed } from 'vue'
import WorkLogCard from './WorkLogCard.vue'
import DayStatusBadge from './DayStatusBadge.vue'

const props = defineProps({
  days: { type: Array, default: () => [] },
  logs: { type: Array, default: () => [] },
  dayStatuses: { type: Array, default: () => [] },
  selectedDate: { type: String, required: true },
})
const emit = defineEmits(['select-date', 'edit'])

const weekData = computed(() => props.days.map((day) => {
  const items = props.logs
    .filter((item) => item.date === day.date)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'work' ? -1 : 1
      return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)
    })
  const sum = (type) => items.filter((item) => item.type === type)
    .reduce((total, item) => total + (Number(item.hours) || 0), 0)
  return {
    ...day,
    items,
    workHours: sum('work'),
    overtimeHours: sum('overtime'),
    dayStatus: props.dayStatuses.find((status) => status.date === day.date) || null,
  }
}))

const hoursLabel = (hours) => `${Number(hours.toFixed(2))}h`
const isSaturday = (day) => day.weekday === '週六'
const isSunday = (day) => day.weekday === '週日'
</script>

<template>
  <div class="wl-week-scroll" aria-label="每週工作紀錄">
    <div class="wl-week-grid">
      <section
        v-for="day in weekData"
        :key="day.date"
        class="wl-week-column"
        :class="{
          'wl-week-column--selected': day.date === selectedDate,
          'wl-week-column--weekend': isSaturday(day) || isSunday(day),
        }"
        :aria-label="`${day.weekday} ${day.label}：${day.items.length} 筆紀錄`"
      >
        <button
          type="button"
          class="wl-week-day-button"
          :aria-current="day.date === selectedDate ? 'date' : undefined"
          :title="`前往 ${day.date} 的單日紀錄`"
          @click="emit('select-date', day.date)"
        >
          <div class="wl-week-day-top">
            <div class="wl-week-day-name" :class="{ 'wl-week-saturday': isSaturday(day), 'wl-week-sunday': isSunday(day) }">{{ day.weekday }}</div>
            <DayStatusBadge v-if="day.dayStatus" :status="day.dayStatus" class="wl-week-holiday" />
          </div>
          <div class="wl-week-day-number" :class="{ 'wl-week-saturday': isSaturday(day), 'wl-week-sunday': isSunday(day) }">{{ day.label }}</div>
          <div class="wl-week-totals">
            <span>工作 {{ hoursLabel(day.workHours) }}</span>
            <span v-if="day.overtimeHours > 0" class="wl-week-overtime-hours">加班 {{ hoursLabel(day.overtimeHours) }}</span>
          </div>
          <div class="wl-week-count">{{ day.items.length }} 筆紀錄</div>
        </button>
        <div class="wl-week-day-divider"></div>
        <div class="wl-week-entries">
          <WorkLogCard
            v-for="item in day.items"
            :key="item.id"
            :item="item"
            variant="week"
            @edit="emit('edit', $event)"
          />
          <p v-if="!day.items.length" class="wl-week-empty">{{ day.dayStatus ? '當日無工作紀錄' : '尚無紀錄' }}</p>
        </div>
      </section>
    </div>
  </div>
</template>
