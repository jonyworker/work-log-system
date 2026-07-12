<script setup>
import { computed } from 'vue'
import WorkLogCard from './WorkLogCard.vue'

const props = defineProps({
  logs: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits([
  'add',
  'edit',
])

const workLogs = computed(() =>
  props.logs
    .filter((item) => item.type === 'work')
    .sort((a, b) => a.sortOrder - b.sortOrder)
)

const overtimeLogs = computed(() =>
  props.logs
    .filter((item) => item.type === 'overtime')
    .sort((a, b) => a.sortOrder - b.sortOrder)
)

const workHours = computed(() =>
  workLogs.value.reduce((total, item) => total + Number(item.hours), 0)
)

const overtimeHours = computed(() =>
  overtimeLogs.value.reduce((total, item) => total + Number(item.hours), 0)
)
</script>

<template>
  <div class="grid gap-5 lg:grid-cols-2">
    <section class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <header class="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 class="font-bold text-slate-900">正常工作</h2>
          <p class="text-sm text-slate-500">合計 {{ workHours }} 小時</p>
        </div>

        <button
          type="button"
          class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          @click="emit('add', 'work')"
        >
          ＋ 新增工作
        </button>
      </header>

      <div class="space-y-3">
        <WorkLogCard
          v-for="item in workLogs"
          :key="item.id"
          :item="item"
          @edit="emit('edit', $event)"
        />

        <p
          v-if="!workLogs.length"
          class="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-400"
        >
          這一天尚無工作紀錄
        </p>
      </div>
    </section>

    <section class="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <header class="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 class="font-bold text-slate-900">加班</h2>
          <p class="text-sm text-slate-500">合計 {{ overtimeHours }} 小時</p>
        </div>

        <button
          type="button"
          class="rounded-xl bg-amber-500 px-3 py-2 text-sm font-medium text-white"
          @click="emit('add', 'overtime')"
        >
          ＋ 新增加班
        </button>
      </header>

      <div class="space-y-3">
        <WorkLogCard
          v-for="item in overtimeLogs"
          :key="item.id"
          :item="item"
          @edit="emit('edit', $event)"
        />

        <p
          v-if="!overtimeLogs.length"
          class="rounded-xl border border-dashed border-amber-300 p-5 text-center text-sm text-amber-600/70"
        >
          這一天沒有加班紀錄
        </p>
      </div>
    </section>
  </div>
</template>
