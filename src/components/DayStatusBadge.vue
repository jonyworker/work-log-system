<script setup>
import { computed } from 'vue'
import { getDayStatusLabel, getDayStatusColor } from '../utils/dayStatus.js'

const props = defineProps({
  status: { type: Object, default: null },
  showHours: { type: Boolean, default: true },
})

const label = computed(() => getDayStatusLabel(props.status))
const color = computed(() => getDayStatusColor(props.status))
const hours = computed(() => Number(props.status?.hours) || 0)
</script>

<template>
  <span
    v-if="status"
    class="inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-5"
    :class="color"
    :title="label"
  >
    <span class="min-w-0 truncate">{{ label }}<template v-if="showHours && hours > 0"> {{ hours }}h</template></span>
  </span>
</template>
