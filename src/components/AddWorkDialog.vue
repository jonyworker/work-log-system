<script setup>
import { reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useCategoryStore } from '../stores/categoryStore'

const props = defineProps({
  open: Boolean,
  type: { type: String, default: 'work' },
  date: { type: String, required: true },
  editingLog: { type: Object, default: null },
  isSaving: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'submit', 'delete'])

const categoryStore = useCategoryStore()
const { activeCategories } = storeToRefs(categoryStore)

const compTimeTouched = ref(false)

const form = reactive({
  category: '',
  hours: 1,
  compTimeHours: 0,
  content: '',
})

watch(
  () => props.open,
  (open) => {
    if (!open) return

    compTimeTouched.value = false

    if (props.editingLog) {
      form.category = props.editingLog.category
      form.hours = Number(props.editingLog.hours)
      form.compTimeHours = Number(props.editingLog.compTimeHours) || 0
      form.content = props.editingLog.content
      return
    }

    form.category = ''
    form.hours = 1
    form.compTimeHours = props.type === 'overtime' ? 1 : 0
    form.content = ''
  }
)

watch(
  () => form.hours,
  (hours) => {
    if (props.type === 'overtime' && !compTimeTouched.value && !props.editingLog) {
      form.compTimeHours = Number(hours) || 0
    }
  }
)

function handleSubmit() {
  if (!form.category || !form.content.trim() || Number(form.hours) <= 0) return

  emit('submit', {
    date: props.editingLog?.date || props.date,
    type: props.editingLog?.type || props.type,
    category: form.category,
    hours: Number(form.hours),
    compTimeHours:
      (props.editingLog?.type || props.type) === 'overtime'
        ? Math.max(0, Number(form.compTimeHours) || 0)
        : 0,
    content: form.content.trim(),
  })
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
    @pointerdown.self="emit('close')"
  >
    <form
      class="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
      @pointerdown.stop
      @submit.prevent="handleSubmit"
    >
      <header class="mb-5 flex items-start justify-between">
        <div>
          <p class="text-sm text-slate-500">{{ editingLog?.date || date }}</p>
          <h2 class="text-xl font-bold text-slate-900">
            <template v-if="editingLog">編輯紀錄</template>
            <template v-else>{{ type === 'overtime' ? '新增加班' : '新增工作' }}</template>
          </h2>
        </div>
        <button type="button" class="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100" @click="emit('close')">✕</button>
      </header>

      <div class="space-y-4">
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">分類</span>
          <select v-model="form.category" required class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5">
            <option disabled value="">請選擇分類</option>
            <option v-for="category in activeCategories" :key="category.id" :value="category.name">{{ category.name }}</option>
          </select>
        </label>

        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">工時</span>
          <input v-model.number="form.hours" type="number" min="0.5" step="0.5" required class="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
        </label>

        <label v-if="(editingLog?.type || type) === 'overtime'" class="block rounded-xl border border-amber-200 bg-amber-50 p-3">
          <span class="mb-1 block text-sm font-medium text-amber-900">可轉補休時數</span>
          <input
            v-model.number="form.compTimeHours"
            type="number"
            min="0"
            :max="form.hours"
            step="0.5"
            class="w-full rounded-xl border border-amber-300 bg-white px-3 py-2.5"
            @input="compTimeTouched = true"
          />
          <span class="mt-1 block text-xs text-amber-700">若本次加班改領加班費或不能換補休，可填 0。</span>
        </label>

        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">工作內容</span>
          <textarea v-model="form.content" rows="4" required placeholder="輸入今天完成的工作" class="w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5" />
        </label>
      </div>

      <footer class="mt-6 flex items-center justify-between gap-3">
        <button v-if="editingLog" type="button" :disabled="isSaving" class="rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50" @click="emit('delete', editingLog)">刪除這筆紀錄</button>
        <div class="ml-auto flex gap-3">
          <button type="button" :disabled="isSaving" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50" @click="emit('close')">取消</button>
          <button type="submit" :disabled="isSaving" class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{{ isSaving ? '儲存中…' : editingLog ? '儲存修改' : '加入紀錄' }}</button>
        </div>
      </footer>
    </form>
  </div>
</template>
