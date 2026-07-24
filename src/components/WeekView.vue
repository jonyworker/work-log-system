<script setup>
import { computed } from 'vue'
import WorkLogCard from './WorkLogCard.vue'

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

const emit = defineEmits([
  'select-date',
  'edit',
])

const weekData = computed(() =>
  props.days.map((day) => {
    const items = props.logs
      .filter((item) => item.date === day.date)
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'work' ? -1 : 1
        }

        return a.sortOrder - b.sortOrder
      })

    const dayStatus =
      props.dayStatuses.find(
        (status) => status.date === day.date
      ) || null

    const workHours = items
      .filter((item) => item.type === 'work')
      .reduce(
        (total, item) => total + Number(item.hours),
        0
      )

    const overtimeHours = items
      .filter((item) => item.type === 'overtime')
      .reduce(
        (total, item) => total + Number(item.hours),
        0
      )

    return {
      ...day,
      items,
      dayStatus,
      workHours,
      overtimeHours,
    }
  })
)

function getColumnClasses(day) {
  return [
    day.date === props.selectedDate
      ? 'border-slate-900 ring-2 ring-slate-900/10'
      : 'border-slate-200',

    {
      'border-t-blue-500': day.weekday === '週六',
      'border-t-red-500': day.weekday === '週日',

      'border-t-slate-300':
        day.weekday !== '週六' &&
        day.weekday !== '週日',
    },
  ]
}

function getWeekdayClasses(day) {
  return {
    'text-blue-600': day.weekday === '週六',
    'text-red-600': day.weekday === '週日',

    'text-slate-500':
      day.weekday !== '週六' &&
      day.weekday !== '週日',
  }
}

function getDateClasses(day) {
  return {
    'text-blue-700': day.weekday === '週六',
    'text-red-700': day.weekday === '週日',

    'text-slate-950':
      day.weekday !== '週六' &&
      day.weekday !== '週日',
  }
}

function getStatusDotClasses(status) {
  const styles = {
    holiday: 'bg-red-500',
    makeupWork: 'bg-blue-500',
    annualLeave: 'bg-emerald-500',
    compLeave: 'bg-violet-500',
    personalLeave: 'bg-orange-500',
    sickLeave: 'bg-rose-500',
    typhoon: 'bg-cyan-500',
  }

  return styles[status] || 'bg-slate-400'
}

function getStatusTextClasses(status) {
  const styles = {
    holiday: 'text-red-700',
    makeupWork: 'text-blue-700',
    annualLeave: 'text-emerald-700',
    compLeave: 'text-violet-700',
    personalLeave: 'text-orange-700',
    sickLeave: 'text-rose-700',
    typhoon: 'text-cyan-700',
  }

  return styles[status] || 'text-slate-600'
}
</script>

<template>
  <div class="overflow-x-auto pb-3">
    <div class="grid min-w-[1120px] grid-cols-7 gap-3">
      <section
        v-for="day in weekData"
        :key="day.date"
        class="min-h-[460px] overflow-hidden rounded-2xl border border-t-4 bg-white shadow-sm transition"
        :class="getColumnClasses(day)"
      >
        <!-- A 區：固定高度 -->
        <button
          type="button"
          class="flex h-[100px] w-full flex-col justify-between px-4 py-3 text-left transition hover:bg-slate-50"
          @click="emit('select-date', day.date)"
        >
          <!-- 上排 -->
          <div class="flex items-start justify-between gap-3">
            <!-- 左上：星期、日期 -->
            <div class="min-w-0">
              <span
                class="block text-xs font-semibold"
                :class="getWeekdayClasses(day)"
              >
                {{ day.weekday }}
              </span>

              <span
                class="mt-1 block text-xl font-bold leading-none"
                :class="getDateClasses(day)"
              >
                {{ day.label }}
              </span>
            </div>

            <!-- 右上：日期狀態 -->
            <div
              v-if="day.dayStatus"
              class="flex shrink-0 items-center gap-1.5 pt-1"
              :class="
                getStatusTextClasses(day.dayStatus.status)
              "
            >
              <span
                class="h-1.5 w-1.5 rounded-full"
                :class="
                  getStatusDotClasses(day.dayStatus.status)
                "
              ></span>

              <span class="text-[10px] font-semibold">
                {{ day.dayStatus.label }}{{ Number(day.dayStatus.hours) > 0 ? ` ${day.dayStatus.hours}h` : '' }}
              </span>
            </div>
          </div>

          <!-- 左下：工時 -->
          <div class="flex items-center gap-2 ">
            <span class="text-xs text-slate-500">
              工作 {{ day.workHours }}h
            </span>

            <span
              v-if="day.overtimeHours"
              class="text-xs font-semibold text-amber-600"
            >
              加班 {{ day.overtimeHours }}h
            </span>
          </div>
        </button>

        <!-- A / B 分隔 -->
        <div class="mx-3 border-t border-slate-200"></div>

        <!-- B 區：工作紀錄 -->
        <div class="space-y-3 px-3 py-3">
          <WorkLogCard
            v-for="item in day.items"
            :key="item.id"
            :item="item"
            @edit="emit('edit', $event)"
          />

          <div
            v-if="!day.items.length"
            class="rounded-xl border border-dashed border-slate-200 px-3 py-7 text-center"
          >
            <p class="text-xs text-slate-400">
              尚無紀錄
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>