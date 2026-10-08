
<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import WorkLogCard from './WorkLogCard.vue'
import DayStatusBadge from './DayStatusBadge.vue'

const props = defineProps({
  days: {
    type: Array,
    default: () => [],
  },
  logs: {
    type: Array,
    default: () => [],
  },
  dayStatuses: {
    type: Array,
    default: () => [],
  },
  selectedDate: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['select-date', 'edit'])

const hoveredDay = ref(null)
const hoverPanelPosition = ref({ top: 0, left: 0 })
let closeTimer = null

function getDayTextClass(day) {
  if (day.weekdayIndex === 0) {
    return 'text-red-600'
  }

  if (day.weekdayIndex === 6) {
    return 'text-blue-600'
  }

  return 'text-slate-900'
}

const monthData = computed(() =>
  props.days.map((day) => {
    const items = props.logs
      .filter((item) => item.date === day.date)
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'work' ? -1 : 1
        }
        return Number(a.sortOrder) - Number(b.sortOrder)
      })

    const workHours = items
      .filter((item) => item.type === 'work')
      .reduce((total, item) => total + Number(item.hours || 0), 0)

    const overtimeHours = items
      .filter((item) => item.type === 'overtime')
      .reduce((total, item) => total + Number(item.hours || 0), 0)

    const status = props.dayStatuses.find(
      (item) => item.date === day.date
    ) ?? null

    return {
      ...day,
      items,
      status,
      workHours,
      overtimeHours,
    }
  })
)

function clearCloseTimer() {
  if (!closeTimer) return
  clearTimeout(closeTimer)
  closeTimer = null
}

function openHoverPanel(day, event) {
  clearCloseTimer()

  if (!day.items.length) {
    hoveredDay.value = null
    return
  }

  hoveredDay.value = day

  const rect = event.currentTarget.getBoundingClientRect()
  const panelWidth = 360
  const gap = 10
  const padding = 12

  let left = rect.right + gap

  if (left + panelWidth > window.innerWidth - padding) {
    left = rect.left - panelWidth - gap
  }

  left = Math.max(
    padding,
    Math.min(left, window.innerWidth - panelWidth - padding)
  )

  let top = rect.top
  const estimatedHeight = 520

  if (top + estimatedHeight > window.innerHeight - padding) {
    top = window.innerHeight - estimatedHeight - padding
  }

  top = Math.max(padding, top)

  hoverPanelPosition.value = { top, left }
}

function scheduleCloseHoverPanel() {
  clearCloseTimer()
  closeTimer = setTimeout(() => {
    hoveredDay.value = null
  }, 120)
}

function closeHoverPanel() {
  clearCloseTimer()
  hoveredDay.value = null
}

function handleSelectDate(date) {
  closeHoverPanel()
  emit('select-date', date)
}

function handleEdit(item) {
  closeHoverPanel()
  emit('edit', item)
}

onBeforeUnmount(clearCloseTimer)
</script>

<template>
  <div class="overflow-x-auto pb-3">
    <div class="min-w-245">

      <!-- 星期標題 -->
      <div
        class="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500"
      >
        <div>週一</div>
        <div>週二</div>
        <div>週三</div>
        <div>週四</div>
        <div>週五</div>
        <div class="text-blue-600">週六</div>
        <div class="text-red-600">週日</div>
      </div>

      <!-- 月曆 -->
      <div class="grid grid-cols-7 gap-2">
        <article
          v-for="day in monthData"
          :key="day.date"
          class="relative h-34.5 rounded-xl border bg-white p-3 transition hover:border-slate-400 hover:shadow-md"
          :class="[
            day.inCurrentMonth
              ? 'border-slate-200'
              : 'border-slate-100 bg-slate-50/70',
            day.date === selectedDate
              ? 'ring-2 ring-slate-900/15'
              : '',
          ]"
          @mouseenter="openHoverPanel(day, $event)"
          @mouseleave="scheduleCloseHoverPanel"
        >
          <button
            type="button"
            class="flex h-full w-full flex-col text-left"
            @click="handleSelectDate(day.date)"
          >
            <!-- 日期與假日標籤 -->
            <div
              class="flex w-full items-start justify-between gap-2"
            >
              <span
                class="text-sm font-bold"
                :class="[
                  getDayTextClass(day),
                  day.inCurrentMonth ? '' : 'opacity-35',
                ]"
              >
                {{ day.dayNumber }}
              </span>

              <DayStatusBadge
                v-if="day.status"
                :status="day.status"
              />
            </div>

            <!-- 工作時數摘要 -->
            <div
              v-if="day.items.length"
              class="mt-auto space-y-1 text-[11px] text-slate-500"
            >
              <div>
                工作 {{ day.workHours }}h
              </div>

              <div
                v-if="day.overtimeHours"
                class="font-semibold text-amber-600"
              >
                加班 {{ day.overtimeHours }}h
              </div>

              <div class="text-slate-400">
                {{ day.items.length }} 筆紀錄
              </div>
            </div>

            <div
              v-else
              class="mt-auto text-[11px] text-slate-300"
            >
              尚無紀錄
            </div>
          </button>
        </article>
      </div>
    </div>
  </div>

  <!-- Hover 詳細紀錄 -->
  <Teleport to="body">
    <div
      v-if="hoveredDay"
      class="fixed z-100 w-90 max-w-[calc(100vw-24px)]"
      :style="{
        top: hoverPanelPosition.top + 'px',
        left: hoverPanelPosition.left + 'px',
      }"
      @mouseenter="clearCloseTimer"
      @mouseleave="scheduleCloseHoverPanel"
    >
      <div
        class="max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl"
      >
        <!-- Hover 標題 -->
        <div
          class="mb-3 flex items-start justify-between gap-4 border-b border-slate-100 pb-3"
        >
          <div>
            <p class="text-sm font-bold text-slate-900">
              {{ hoveredDay.date }}
            </p>

            <div class="mt-1 flex flex-wrap gap-2 text-xs">
              <span class="text-slate-500">
                工作 {{ hoveredDay.workHours }}h
              </span>

              <span
                v-if="hoveredDay.overtimeHours"
                class="font-semibold text-amber-600"
              >
                加班 {{ hoveredDay.overtimeHours }}h
              </span>
            </div>
          </div>

          <!-- Hover 假日標籤 -->
          <DayStatusBadge
            v-if="hoveredDay.status"
            class="shrink-0"
            :status="hoveredDay.status"
          />
        </div>

        <!-- 工作紀錄 -->
        <div class="space-y-3">
          <WorkLogCard
            v-for="item in hoveredDay.items"
            :key="item.id"
            :item="item"
            @edit="handleEdit"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>
