<script setup>
import { computed } from 'vue'
import { useCategoryStore } from '../stores/categoryStore'

const props = defineProps({
  item: { type: Object, required: true },
  variant: { type: String, default: 'card' },
})
const emit = defineEmits(['edit'])
const categoryStore = useCategoryStore()
const category = computed(() => categoryStore.getCategory(props.item.category))
const categoryStyle = computed(() => ({
  backgroundColor: category.value?.bgColor || '#F1F5F9',
  color: category.value?.textColor || '#334155',
}))
// Display only: preserve the complete original content in storage and editor.
const editorialParts = computed(() => {
  const original = String(props.item.content || '')
  const match = original.match(/^\s*[\[［]\s*([^\]］]+?)\s*[\]］]\s*(?:[-－–—]\s*)?([\s\S]*)$/)
  return match ? { subject: match[1].trim(), body: match[2].trim() } : { subject: '', body: original }
})
const hoursLabel = computed(() => `${props.item.hours}h`)
</script>

<template>
  <!-- Week View has its own explicit stacked structure; do not rely on CSS wrapping. -->
  <article
    v-if="variant === 'week'"
    role="button" tabindex="0"
    class="wl-entry-editorial wl-entry-editorial--week"
    :class="{ 'wl-entry-editorial--overtime': item.type === 'overtime' }"
    :aria-label="`編輯 ${item.category} 工作紀錄：${item.content}`"
    @click="emit('edit', item)"
    @keydown.enter="emit('edit', item)"
    @keydown.space.prevent="emit('edit', item)"
  >
    <div class="wl-week-entry-meta">
      <span class="wl-entry-category" :style="categoryStyle">{{ item.category }}</span>
      <div class="wl-entry-hours">
        <strong>{{ hoursLabel }}</strong>
        <span v-if="item.type === 'overtime'" class="wl-entry-overtime-label">加班</span>
      </div>
    </div>
    <div v-if="editorialParts.subject" class="wl-week-entry-subject">［{{ editorialParts.subject }}］</div>
    <div v-if="editorialParts.body" class="wl-entry-content wl-week-entry-content"><p>{{ editorialParts.body }}</p></div>
    <div v-if="item.type === 'overtime' && Number(item.compTimeHours) > 0" class="wl-entry-comp">補休 +{{ item.compTimeHours }}h</div>
  </article>

  <article
    v-else-if="variant === 'editorial'"
    role="button" tabindex="0"
    class="wl-entry-editorial"
    :class="{ 'wl-entry-editorial--overtime': item.type === 'overtime' }"
    :aria-label="`編輯 ${item.category} 工作紀錄：${item.content}`"
    @click="emit('edit', item)"
    @keydown.enter="emit('edit', item)"
    @keydown.space.prevent="emit('edit', item)"
  >
    <div class="wl-entry-top">
      <div class="wl-entry-heading">
        <span class="wl-entry-category" :style="categoryStyle">{{ item.category }}</span>
        <span v-if="editorialParts.subject" class="wl-entry-subject">［{{ editorialParts.subject }}］</span>
      </div>
      <div class="wl-entry-hours">
        <strong>{{ hoursLabel }}</strong>
        <span v-if="item.type === 'overtime'" class="wl-entry-overtime-label">加班</span>
      </div>
    </div>
    <div v-if="editorialParts.body" class="wl-entry-content"><p>{{ editorialParts.body }}</p></div>
    <div v-if="item.type === 'overtime' && Number(item.compTimeHours) > 0" class="wl-entry-comp">補休 +{{ item.compTimeHours }}h</div>
  </article>

  <article
    v-else role="button" tabindex="0"
    class="cursor-pointer rounded-xl border p-3 transition duration-150 focus:outline-none focus:ring-2 focus:ring-blue-200"
    :class="item.type === 'overtime' ? 'border-amber-200 bg-amber-50 shadow-sm hover:border-amber-300 hover:shadow-md' : 'border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow-md'"
    @click="emit('edit', item)"
    @keydown.enter="emit('edit', item)"
    @keydown.space.prevent="emit('edit', item)"
  >
    <div class="mb-2 flex items-start gap-2">
      <span class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span class="inline-flex shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold leading-none" :style="categoryStyle">{{ item.category }}</span>
        <span v-if="editorialParts.subject" class="min-w-0 text-xs font-semibold leading-relaxed text-slate-800 break-words">［{{ editorialParts.subject }}］</span>
      </span>
      <div class="ml-auto shrink-0 text-right">
        <span class="block text-sm font-bold" :class="item.type === 'overtime' ? 'text-amber-700' : 'text-slate-700'">{{ item.hours }}h</span>
        <span v-if="item.type === 'overtime'" class="mt-0.5 block text-[10px] font-semibold text-amber-600">加班</span>
        <span v-if="item.type === 'overtime' && Number(item.compTimeHours) > 0" class="mt-0.5 block text-[10px] font-semibold text-emerald-700">補休 +{{ item.compTimeHours }}h</span>
      </div>
    </div>
    <p class="text-sm leading-6" :class="item.type === 'overtime' ? 'text-amber-950' : 'text-slate-800'">{{ editorialParts.body }}</p>
  </article>
</template>
