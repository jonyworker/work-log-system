<script setup>
defineProps({
  viewMode: {
    type: String,
    required: true,
  },

  selectedDate: {
    type: String,
    required: true,
  },

  selectedDateLabel: {
    type: String,
    required: true,
  },

  weekNumber: {
    type: Number,
    required: true,
  },

  weekRangeLabel: {
    type: String,
    required: true,
  },

  selectedDateBaseStatus: {
    type: String,
    required: true,
  },

  selectedDayStatusOverride: {
    type: String,
    required: true,
  },

  dayStatusOptions: {
    type: Array,
    default: () => [],
  },

  selectedDayStatusHours: {
    type: Number,
    default: 0,
  },

  compTimeBalance: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits([
  'update:viewMode',
  'update:selectedDate',
  'update:selectedDayStatusOverride',
  'update:selectedDayStatusHours',
  'previous-week',
  'next-week',
])
</script>

<template>
  <header
    class="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
  >
    <div
      class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"
    >
      <div>
        <p class="text-sm font-medium text-slate-500">
          Work Log
        </p>

        <h1 class="text-2xl font-bold text-slate-950">
          工作紀錄
        </h1>

        <p class="mt-1 text-sm text-slate-500">
          <template v-if="viewMode === 'day'">
            {{ selectedDateLabel }}
          </template>

          <template v-else>
            第 {{ weekNumber }} 週 ·
            {{ weekRangeLabel }}
          </template>
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="inline-flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-medium"
            :class="
              viewMode === 'day'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500'
            "
            @click="emit('update:viewMode', 'day')"
          >
            日
          </button>

          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-medium"
            :class="
              viewMode === 'week'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500'
            "
            @click="emit('update:viewMode', 'week')"
          >
            週
          </button>
        </div>

        <template v-if="viewMode === 'week'">
          <button
            type="button"
            class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            @click="emit('previous-week')"
          >
            ← 上一週
          </button>

          <button
            type="button"
            class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            @click="emit('next-week')"
          >
            下一週 →
          </button>
        </template>

        <div
          v-if="viewMode === 'day'"
          class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
        >
          <span class="text-xs text-slate-500">
            系統判斷：
            <strong class="font-semibold text-slate-700">
              {{ selectedDateBaseStatus }}
            </strong>
          </span>

          <span class="h-4 w-px bg-slate-300"></span>

          <label class="flex items-center gap-2">
            <span class="text-xs text-slate-500">
              覆寫
            </span>

            <select
              :value="selectedDayStatusOverride"
              class="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              @change="
                emit(
                  'update:selectedDayStatusOverride',
                  $event.target.value
                )
              "
            >
              <option
                v-for="option in dayStatusOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <label
            v-if="['annualLeave', 'compLeave', 'personalLeave', 'sickLeave'].includes(selectedDayStatusOverride)"
            class="flex items-center gap-2"
          >
            <span class="text-xs text-slate-500">時數</span>
            <input
              :value="selectedDayStatusHours"
              type="number"
              min="0.5"
              step="0.5"
              class="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              @change="emit('update:selectedDayStatusHours', Number($event.target.value))"
            />
          </label>
        </div>

        <div class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          補休餘額 <strong>{{ compTimeBalance }}h</strong>
        </div>

        <input
          :value="selectedDate"
          type="date"
          class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          @input="
            emit(
              'update:selectedDate',
              $event.target.value
            )
          "
        />
      </div>
    </div>
  </header>
</template>