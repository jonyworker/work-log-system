<script setup>
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import { storeToRefs } from 'pinia'

import AppHeader from './components/AppHeader.vue'
import AppSidebar from './components/AppSidebar.vue'
import { supabase } from './api/apiClient'
import AddWorkDialog from './components/AddWorkDialog.vue'
import DayView from './components/DayView.vue'
import WeekView from './components/WeekView.vue'
import MonthView from './components/MonthView.vue'
import WorkHistoryView from './components/WorkHistoryView.vue'

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
  monthDays,
  monthStartDate,
  monthEndDate,
  monthLabel,
  selectedDateBaseStatus,
  changeWeek,
  changeMonth,
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
  compTimeSummary,
} = storeToRefs(workLogStore)

const {
  records: dayStatuses,
  isLoading: isLoadingDayStatuses,
  isSaving: isSavingDayStatus,
  loadError: dayStatusLoadError,
  saveError: dayStatusSaveError,
} = storeToRefs(dayStatusStore)

const authReady = ref(false)
const currentUser = ref(null)
const loginEmail = ref('')
const loginPassword = ref('')
const loginBusy = ref(false)
const loginError = ref('')
const sidebarCollapsed = ref(false)
const activePage = ref('calendar')
const loggingOut = ref(false)

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  try { localStorage.setItem('worklog-sidebar-collapsed', String(sidebarCollapsed.value)) } catch {}
}
let authSubscription = null

async function login() {
  loginBusy.value = true
  loginError.value = ''
  const { error } = await supabase.auth.signInWithPassword({ email: loginEmail.value, password: loginPassword.value })
  loginBusy.value = false
  if (error) loginError.value = '登入失敗，請確認 Email、密碼及帳號驗證狀態'
  else loginPassword.value = ''
}
async function logout() {
  if (loggingOut.value) return
  loggingOut.value = true
  clearTimeout(prefetchTimer)
  prefetchRevision++
  const { error } = await supabase.auth.signOut()
  loggingOut.value = false
  if (error) { window.alert('登出失敗，請稍後重試'); return }
  currentUser.value = null
  workLogStore.$reset()
  dayStatusStore.$reset()
  categoryStore.$reset()
}
async function initData() {
  await Promise.all([categoryStore.loadCategories(), workLogStore.loadCompTimeSummary(), loadVisibleRange()])
}

const dialogOpen = ref(false)
const dialogType = ref('work')
const editingLog = ref(null)

const dayStatusOptions = [
  {
    value: 'none',
    label: '無',
  },
  { value: 'annualLeave', label: '特休' },
  { value: 'compLeave', label: '補休' },
  { value: 'personalLeave', label: '事假' },
  { value: 'sickLeave', label: '病假' },
  {
    value: 'makeupWork',
    label: '補班',
  },
  {
    value: 'typhoon',
    label: '颱風假',
  },
  { value: 'holiday', label: '國定假日' },
]

const selectedDateLogs = computed(() =>
  workLogStore.getLogsByDate(
    selectedDate.value
  )
)

const selectedDayStatusOverride = computed({
  get() {
    return dayStatusStore.getStatusByDate(selectedDate.value)?.status ?? 'none'
  },
  set(status) {
    const existingHours = Number(dayStatusStore.getStatusByDate(selectedDate.value)?.hours) || 0
    const defaultHours = ['annualLeave', 'compLeave', 'personalLeave', 'sickLeave'].includes(status)
      ? (existingHours || 8)
      : 0
    const defaultLabel = dayStatusOptions.find((item) => item.value === status)?.label ?? ''
    void updateDayStatus(status, defaultHours, defaultLabel)
  },
})

const selectedDayStatusHours = computed({
  get() {
    return Number(dayStatusStore.getStatusByDate(selectedDate.value)?.hours) || 0
  },
  set(hours) {
    void updateDayStatus(selectedDayStatusOverride.value, Number(hours) || 0, selectedDayStatusLabel.value)
  },
})

const selectedDayStatusLabel = computed({
  get() {
    const existing = dayStatusStore.getStatusByDate(selectedDate.value)
    return existing?.label ?? dayStatusOptions.find((item) => item.value === selectedDayStatusOverride.value)?.label ?? ''
  },
  set(value) {
    void updateDayStatus(selectedDayStatusOverride.value, selectedDayStatusHours.value, value.trim())
  },
})

async function updateDayStatus(status, hours = 0, label) {
  await dayStatusStore.setStatus(selectedDate.value, status, hours, label)
  await workLogStore.loadCompTimeSummary()
}


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
function openHistoryDate(date) {
  activePage.value = 'calendar'
  selectDate(date, true)
}

let prefetchTimer = null
let prefetchRevision = 0

function formatLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 與月曆一致，涵蓋月份頭尾的週一至週日。
function monthGridRange(year, monthIndex) {
  const first = new Date(year, monthIndex, 1)
  const last = new Date(year, monthIndex + 1, 0)
  const start = new Date(first)
  start.setDate(start.getDate() - (start.getDay() + 6) % 7)
  const end = new Date(last)
  end.setDate(end.getDate() + (7 - end.getDay()) % 7)
  return [formatLocalDate(start), formatLocalDate(end)]
}

function scheduleAdjacentMonths() {
  clearTimeout(prefetchTimer)
  const revision = ++prefetchRevision
  if (!currentUser.value || viewMode.value !== 'month') return
  const [year, month] = selectedDate.value.split('-').map(Number)
  prefetchTimer = setTimeout(async () => {
    for (const offset of [-1, 1]) {
      if (revision !== prefetchRevision || !currentUser.value || viewMode.value !== 'month') return
      const date = new Date(year, month - 1 + offset, 1)
      const [start, end] = monthGridRange(date.getFullYear(), date.getMonth())
      try {
        await Promise.all([
          workLogStore.loadRange(start, end, false, true),
          dayStatusStore.loadRange(start, end, false, true),
        ])
      } catch (error) {
        // 預載失敗不阻擋操作，使用者切換時仍能正常重新讀取。
        console.warn('相鄰月份背景預載失敗', error)
      }
    }
  }, 250)
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

  if (viewMode.value === 'month') {
    await Promise.all([
      workLogStore.loadRange(
        monthStartDate.value,
        monthEndDate.value,
        force
      ),
      dayStatusStore.loadRange(
        monthStartDate.value,
        monthEndDate.value,
        force
      ),
    ])

    scheduleAdjacentMonths()
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
    monthStartDate,
    monthEndDate,
  ],
  () => {
    clearTimeout(prefetchTimer)
    prefetchRevision++
    if (currentUser.value) void loadVisibleRange()
  }
)

onMounted(async () => {
  try { sidebarCollapsed.value = localStorage.getItem('worklog-sidebar-collapsed') === 'true' } catch {}
  const { data: { session } } = await supabase.auth.getSession()
  currentUser.value = session?.user ?? null
  authReady.value = true
  if (currentUser.value) void initData()
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
    const oldId = currentUser.value?.id
    currentUser.value = nextSession?.user ?? null
    if (event === 'SIGNED_IN' && currentUser.value && oldId !== currentUser.value.id) {
      void initData()
    }
  })
  authSubscription = subscription
})
onUnmounted(() => {
  clearTimeout(prefetchTimer)
  prefetchRevision++
  authSubscription?.unsubscribe()
})
</script>

<template>
  <main class="wl-app-shell" :class="!currentUser ? 'p-3 sm:p-5 lg:p-8' : ''">
    <div v-if="!authReady" class="grid min-h-[70vh] place-items-center text-slate-500">正在確認登入狀態…</div>
    <section v-else-if="!currentUser" class="mx-auto mt-[12vh] max-w-md rounded-2xl bg-white p-7 shadow-lg">
      <h1 class="text-2xl font-bold text-slate-900">工作日誌登入</h1>
      <p class="mt-2 text-sm text-slate-500">請使用你在 Supabase 建立的個人帳號</p>
      <form class="mt-6 space-y-4" @submit.prevent="login">
        <label class="block text-sm font-medium">Email<input v-model.trim="loginEmail" type="email" autocomplete="email" required class="mt-1 w-full rounded-xl border border-slate-300 p-3" /></label>
        <label class="block text-sm font-medium">密碼<input v-model="loginPassword" type="password" autocomplete="current-password" required class="mt-1 w-full rounded-xl border border-slate-300 p-3" /></label>
        <p v-if="loginError" role="alert" class="text-sm text-red-600">{{ loginError }}</p>
        <button :disabled="loginBusy" class="w-full rounded-xl bg-slate-900 p-3 font-medium text-white disabled:opacity-50">{{ loginBusy ? '登入中…' : '登入' }}</button>
      </form>
    </section>
    <template v-else>
      <div class="flex min-h-screen">
        <AppSidebar :collapsed="sidebarCollapsed" :active-page="activePage" :email="currentUser.email || ''" :logging-out="loggingOut" @toggle="toggleSidebar" @navigate="activePage = $event" @logout="logout" />
        <div class="wl-workspace">
          <div class="wl-workspace-inner">
        <AppHeader
          v-if="activePage === 'calendar'"
          v-model:view-mode="viewMode"
          v-model:selected-date="selectedDate"
          v-model:selected-day-status-override="
          selectedDayStatusOverride
        "
          :selected-date-label="selectedDateLabel"
          :week-number="weekNumber"
          :week-range-label="weekRangeLabel"
          :month-label="monthLabel"
          :selected-date-base-status="
          selectedDateBaseStatus
        "
          :day-status-options="dayStatusOptions"
          :day-status-saving="isSavingDayStatus"
          :selected-day-status-hours="selectedDayStatusHours"
          :selected-day-status-label="selectedDayStatusLabel"
          :comp-time-balance="compTimeSummary.balance"
          @update:selected-day-status-hours="selectedDayStatusHours = $event"
          @update:selected-day-status-label="selectedDayStatusLabel = $event"
          @previous-week="changeWeek(-1)"
          @next-week="changeWeek(1)"
          @previous-month="changeMonth(-1)"
          @next-month="changeMonth(1)"
        />

        <WorkHistoryView v-if="activePage === 'history'" @open-date="openHistoryDate" />
        <section
          v-else
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
              v-else-if="viewMode === 'week'"
              :days="weekDays"
              :logs="workLogs"
              :day-statuses="dayStatuses"
              :selected-date="selectedDate"
              @select-date="handleSelectDate"
              @edit="openEditDialog"
            />

            <MonthView
              v-else
              :days="monthDays"
              :logs="workLogs"
              :day-statuses="dayStatuses"
              :selected-date="selectedDate"
              @select-date="handleSelectDate"
            />
          </template>
        </section>
      </div>

      </div>
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
    </template>
  </main>
</template>