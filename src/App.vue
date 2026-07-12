<script setup>
import {
  computed,
  onMounted,
  ref,
  watch,
} from 'vue'
import { storeToRefs } from 'pinia'

import AppHeader from './components/AppHeader.vue'
import AddWorkDialog from './components/AddWorkDialog.vue'
import DayView from './components/DayView.vue'
import WeekView from './components/WeekView.vue'

import { useCalendar } from './composables/useCalendar'
import { useCategoryStore } from './stores/categoryStore'
import { useDayStatusStore } from './stores/dayStatusStore'
import { useWorkLogStore } from './stores/workLogStore'

const {
  selectedDate,
  viewMode,
  weekDays,
  weekStartDate,
  weekEndDate,
  selectedDateLabel,
  weekRangeLabel,
  weekNumber,
  selectedDateBaseStatus,
  changeWeek,
  selectDate,
} = useCalendar()

const workLogStore = useWorkLogStore()
const dayStatusStore = useDayStatusStore()
const categoryStore = useCategoryStore()

const {
  records: workLogs,
  isLoading: isLoadingWorkLogs,
  isSaving: isSavingWorkLog,
  loadError: workLogLoadError,
  saveError: workLogSaveError,
} = storeToRefs(workLogStore)

const {
  records: dayStatuses,
  isLoading: isLoadingDayStatuses,
  isSaving: isSavingDayStatus,
  loadError: dayStatusLoadError,
  saveError: dayStatusSaveError,
} = storeToRefs(dayStatusStore)

const dialogOpen = ref(false)
const dialogType = ref('work')
const editingLog = ref(null)

const dayStatusOptions = [
  {
    value: 'none',
    label: '無',
  },
  {
    value: 'annualLeave',
    label: '特休',
  },
  {
    value: 'makeupWork',
    label: '補班',
  },
  {
    value: 'typhoon',
    label: '颱風假',
  },
]

const selectedDateLogs = computed(() =>
  workLogStore.getLogsByDate(
    selectedDate.value
  )
)

const selectedDayStatusOverride = computed({
  get() {
    return (
      dayStatusStore.getStatusByDate(
        selectedDate.value
      )?.status ?? 'none'
    )
  },

  set(status) {
    void dayStatusStore.setStatus(
      selectedDate.value,
      status
    )
  },
})

const isLoading = computed(
  () =>
    isLoadingWorkLogs.value ||
    isLoadingDayStatuses.value ||
    categoryStore.isLoading
)

const loadError = computed(
  () =>
    workLogLoadError.value ||
    dayStatusLoadError.value ||
    categoryStore.error
)

const saveError = computed(
  () =>
    workLogSaveError.value ||
    dayStatusSaveError.value
)

function openAddDialog(type) {
  editingLog.value = null
  dialogType.value = type
  dialogOpen.value = true
}

function openEditDialog(record) {
  editingLog.value = { ...record }
  dialogType.value = record.type
  dialogOpen.value = true
}

function closeDialog() {
  dialogOpen.value = false
  editingLog.value = null
}

async function saveWorkLog(payload) {
  if (editingLog.value) {
    await workLogStore.updateRecord({
      id: editingLog.value.id,
      ...payload,
      sortOrder: editingLog.value.sortOrder,
    })
  } else {
    await workLogStore.addRecord(payload)
  }

  closeDialog()
}

async function removeWorkLog(record) {
  const confirmed = window.confirm(
    `確定要刪除「${record.content}」嗎？`
  )

  if (!confirmed) return

  await workLogStore.removeRecord(record)
  closeDialog()
}

function handleSelectDate(date) {
  selectDate(date, true)
}

async function loadVisibleRange(force = false) {
  if (viewMode.value === 'day') {
    await Promise.all([
      workLogStore.loadRange(
        selectedDate.value,
        selectedDate.value,
        force
      ),
      dayStatusStore.loadRange(
        selectedDate.value,
        selectedDate.value,
        force
      ),
    ])

    return
  }

  await Promise.all([
    workLogStore.loadRange(
      weekStartDate.value,
      weekEndDate.value,
      force
    ),
    dayStatusStore.loadRange(
      weekStartDate.value,
      weekEndDate.value,
      force
    ),
  ])
}

watch(
  [
    selectedDate,
    viewMode,
    weekStartDate,
    weekEndDate,
  ],
  () => {
    void loadVisibleRange()
  }
)

onMounted(async () => {
  await Promise.all([
    categoryStore.loadCategories(),
    loadVisibleRange(),
  ])
})
</script>

<template>
  <main class="min-h-screen bg-slate-100 p-3 sm:p-5 lg:p-8">
    <div class="mx-auto max-w-[1500px]">
      <AppHeader
        v-model:view-mode="viewMode"
        v-model:selected-date="selectedDate"
        v-model:selected-day-status-override="
          selectedDayStatusOverride
        "
        :selected-date-label="selectedDateLabel"
        :week-number="weekNumber"
        :week-range-label="weekRangeLabel"
        :selected-date-base-status="
          selectedDateBaseStatus
        "
        :day-status-options="dayStatusOptions"
        :day-status-saving="isSavingDayStatus"
        @previous-week="changeWeek(-1)"
        @next-week="changeWeek(1)"
      />

      <div
        v-if="workLogError || dayStatusError"
        class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ workLogError || dayStatusError }}
      </div>

      <section
        class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div
          v-if="saveError"
          class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {{ saveError }}
        </div>

        <div
          v-if="isLoading"
          class="grid min-h-64 place-items-center"
        >
          <div class="text-center">
            <div
              class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900"
            ></div>

            <p class="mt-3 text-sm text-slate-500">
              正在讀取資料……
            </p>
          </div>
        </div>

        <div
          v-else-if="loadError"
          class="grid min-h-64 place-items-center"
        >
          <div class="text-center">
            <p class="font-semibold text-red-700">
              無法載入資料
            </p>

            <p class="mt-2 text-sm text-slate-500">
              {{ loadError }}
            </p>

            <button
              type="button"
              class="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white"
              @click="loadVisibleRange(true)"
            >
              重新載入
            </button>
          </div>
        </div>

        <template v-else>
          <DayView
            v-if="viewMode === 'day'"
            :logs="selectedDateLogs"
            @add="openAddDialog"
            @edit="openEditDialog"
          />

          <WeekView
            v-else
            :days="weekDays"
            :logs="workLogs"
            :day-statuses="dayStatuses"
            :selected-date="selectedDate"
            @select-date="handleSelectDate"
            @edit="openEditDialog"
          />
        </template>
      </section>
    </div>

    <AddWorkDialog
      :open="dialogOpen"
      :type="dialogType"
      :date="selectedDate"
      :editing-log="editingLog"
      :is-saving="isSavingWorkLog"
      @close="closeDialog"
      @submit="saveWorkLog"
      @delete="removeWorkLog"
    />
  </main>
</template>