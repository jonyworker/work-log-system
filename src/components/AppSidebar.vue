<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  collapsed: { type: Boolean, default: false },
  activePage: { type: String, default: 'calendar' },
  email: { type: String, default: '' },
  loggingOut: { type: Boolean, default: false },
})
const emit = defineEmits(['toggle', 'logout', 'navigate'])
const accountOpen = ref(false)
const accountArea = ref(null)
function closeAccountMenu(event) {
  if (event.type === 'keydown' && event.key === 'Escape') {
    accountOpen.value = false
    return
  }
  if (event.type === 'pointerdown' && accountArea.value && !accountArea.value.contains(event.target)) {
    accountOpen.value = false
  }
}
function navigate(page) {
  accountOpen.value = false
  emit('navigate', page)
}
onMounted(() => {
  document.addEventListener('pointerdown', closeAccountMenu)
  document.addEventListener('keydown', closeAccountMenu)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeAccountMenu)
  document.removeEventListener('keydown', closeAccountMenu)
})

function requestLogout() {
  accountOpen.value = false
  emit('logout')
}
</script>

<template>
  <aside class="wl-sidebar" :class="{ 'wl-sidebar--collapsed': collapsed }" aria-label="主要導覽">
    <div class="wl-sidebar-top">
      <span v-if="!collapsed" class="wl-brand">WORKLOG</span>
      <button type="button" class="wl-icon-button" :aria-label="collapsed ? '展開側邊欄' : '收合側邊欄'" :title="collapsed ? '展開側邊欄' : '收合側邊欄'" @click="emit('toggle')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path v-if="collapsed" d="m13 9 3 3-3 3"/><path v-else d="m17 9-3 3 3 3"/></svg>
      </button>
    </div>

    <nav class="wl-sidebar-nav" aria-label="功能選單">
      <button type="button" class="wl-nav-item" :class="{ 'wl-nav-item--active': activePage === 'calendar' }" :aria-current="activePage === 'calendar' ? 'page' : undefined" :title="collapsed ? '工作日曆' : undefined" @click="navigate('calendar')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>
        <span v-if="!collapsed">工作日曆</span>
      </button>
      <button type="button" class="wl-nav-item" :class="{ 'wl-nav-item--active': activePage === 'history' }" :aria-current="activePage === 'history' ? 'page' : undefined" :title="collapsed ? '工作歷程' : undefined" @click="navigate('history')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></svg>
        <span v-if="!collapsed">工作歷程</span>
      </button>
    </nav>

    <div ref="accountArea" class="wl-sidebar-bottom">
      <button type="button" class="wl-account-trigger" :aria-expanded="accountOpen" aria-label="帳號選單" :title="collapsed ? '帳號選單' : undefined" @click="accountOpen = !accountOpen">
        <span class="wl-avatar">{{ email?.charAt(0)?.toUpperCase() || 'U' }}</span>
        <span v-if="!collapsed" class="wl-account-name">{{ email || '個人帳號' }}</span>
        <svg v-if="!collapsed" class="wl-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m7 10 5 5 5-5"/></svg>
      </button>
      <div v-if="accountOpen" class="wl-account-menu" role="menu" aria-label="帳號操作">
        <div class="wl-account-email" :title="email">{{ email }}</div>
        <button type="button" :disabled="loggingOut" @click="requestLogout">{{ loggingOut ? '登出中…' : '登出' }}</button>
      </div>
    </div>
  </aside>
</template>
