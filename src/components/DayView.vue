<script setup>
import { computed } from 'vue'
import WorkLogCard from './WorkLogCard.vue'

const props = defineProps({
  logs: { type: Array, default: () => [] },
})
const emit = defineEmits(['add', 'edit'])

const workLogs = computed(() => props.logs.filter((item) => item.type === 'work').sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)))
const overtimeLogs = computed(() => props.logs.filter((item) => item.type === 'overtime').sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)))
const workHours = computed(() => workLogs.value.reduce((sum, item) => sum + (Number(item.hours) || 0), 0))
const overtimeHours = computed(() => overtimeLogs.value.reduce((sum, item) => sum + (Number(item.hours) || 0), 0))
const compHours = computed(() => overtimeLogs.value.reduce((sum, item) => sum + (Number(item.compTimeHours) || 0), 0))
const hoursLabel = (value) => `${Number(value.toFixed(2))}h`
</script>

<template>
  <div class="wl-day-grid">
    <section class="wl-day-panel" aria-label="正常工作紀錄">
      <header class="wl-day-panel-head">
        <div class="wl-day-heading">
          <h2>正常工作</h2>
          <p>合計 <strong>{{ hoursLabel(workHours) }}</strong> · {{ workLogs.length }} 筆紀錄</p>
        </div>
        <button type="button" class="wl-day-add wl-day-add--work" @click="emit('add', 'work')">＋ 新增工作</button>
      </header>
      <div class="wl-day-entries">
        <WorkLogCard v-for="item in workLogs" :key="item.id" :item="item" variant="editorial" @edit="emit('edit', $event)" />
        <div v-if="!workLogs.length" class="wl-day-empty">當天尚無工作紀錄 <span>點選「新增工作」開始記錄</span></div>
      </div>
    </section>

    <section class="wl-day-panel wl-day-panel--overtime" aria-label="加班紀錄">
      <header class="wl-day-panel-head">
        <div class="wl-day-heading">
          <h2>加班</h2>
          <p>合計 <strong class="wl-day-overtime-hours">{{ hoursLabel(overtimeHours) }}</strong> · {{ overtimeLogs.length }} 筆紀錄</p>
          <p v-if="compHours > 0" class="wl-day-comp">補休 +{{ hoursLabel(compHours) }}</p>
        </div>
        <button type="button" class="wl-day-add wl-day-add--overtime" @click="emit('add', 'overtime')">＋ 新增加班</button>
      </header>
      <div class="wl-day-entries">
        <WorkLogCard v-for="item in overtimeLogs" :key="item.id" :item="item" variant="editorial" @edit="emit('edit', $event)" />
        <div v-if="!overtimeLogs.length" class="wl-day-empty">當天沒有加班紀錄</div>
      </div>
    </section>
  </div>
</template>
