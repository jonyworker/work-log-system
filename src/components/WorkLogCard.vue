<script setup>
import { computed } from 'vue'
import { useCategoryStore } from '../stores/categoryStore'

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['edit'])

const categoryStore = useCategoryStore()

const category = computed(() =>
  categoryStore.getCategory(props.item.category)
)

const categoryStyle = computed(() => ({
  backgroundColor:
    category.value?.bgColor || '#F1F5F9',

  color:
    category.value?.textColor || '#334155',
}))
</script>

<template>
  <article
    role="button"
    tabindex="0"
    class="cursor-pointer rounded-xl border p-3 transition duration-150 focus:outline-none focus:ring-2 focus:ring-blue-200"
    :class="
      item.type === 'overtime'
        ? 'border-amber-200 bg-amber-50 shadow-sm hover:border-amber-300 hover:shadow-md'
        : 'border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow-md'
    "
    @click="emit('edit', item)"
    @keydown.enter="emit('edit', item)"
    @keydown.space.prevent="emit('edit', item)"
  >
    <div class="mb-2 flex items-start justify-between gap-3">
      <span
        class="inline-flex rounded-md px-2 py-1 text-[10px] font-semibold leading-none"
        :style="categoryStyle"
      >
        {{ item.category }}
      </span>

      <div class="shrink-0 text-right">
        <span
          class="block text-sm font-bold"
          :class="
            item.type === 'overtime'
              ? 'text-amber-700'
              : 'text-slate-700'
          "
        >
          {{ item.hours }}h
        </span>

        <span
          v-if="item.type === 'overtime'"
          class="mt-0.5 block text-[10px] font-semibold text-amber-600"
        >
          加班
        </span>
      </div>
    </div>

    <p
      class="text-sm leading-6"
      :class="
        item.type === 'overtime'
          ? 'text-amber-950'
          : 'text-slate-800'
      "
    >
      {{ item.content }}
    </p>
  </article>
</template>